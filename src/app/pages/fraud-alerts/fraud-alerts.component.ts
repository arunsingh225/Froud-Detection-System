import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FraudAlertService } from '../../services/fraud-alert.service';
import { TransactionService } from '../../services/transaction.service';
import { FraudAlert } from '../../models/alert.model';
import { RiskTier, AlertStatus } from '../../models/types.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ProbabilityBarComponent } from '../../shared/components/probability-bar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-fraud-alerts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    RiskBadgeComponent,
    StatusBadgeComponent,
    ProbabilityBarComponent,
    EmptyStateComponent,
    InrCurrencyPipe
  ],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }
  `],
  template: `
    <div class="w-full min-h-full bg-[#0A0A0A] text-[#D4D4D4] p-4 lg:p-8 pb-12 space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight">Fraud Alerts</h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Triaged real-time alerts awaiting investigator assignment or automated resolution.
          </p>
        </div>
        <button
          (click)="refreshData()"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#141414] border border-white/10 hover:border-[#C5A059]/40 text-[#C5A059] text-[12px] font-semibold transition-colors cursor-pointer"
        >
          <span class="material-symbols-outlined text-[16px]">refresh</span>
          Refresh
        </button>
      </div>

      <!-- Loading State -->
      <div *ngIf="alertService.loading()" class="flex items-center justify-center py-16">
        <div class="flex items-center gap-3 text-[#C5A059]">
          <div class="w-5 h-5 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
          <span class="text-[13px]">Loading fraud alerts...</span>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="alertService.error()" class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-red-400 text-[20px]">error</span>
          <span class="text-[13px] text-red-400">{{ alertService.error() }}</span>
        </div>
        <button
          (click)="refreshData()"
          class="px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>

      <ng-container *ngIf="!alertService.loading()">
      <!-- Tabs and Risk Filter -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
        <div class="flex items-center gap-2 overflow-x-auto">
          <button
            *ngFor="let tab of statusTabs"
            (click)="activeTab = tab.value"
            class="px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap cursor-pointer"
            [ngClass]="activeTab === tab.value ? 'bg-[#C5A059] text-[#0A0A0A] font-semibold' : 'bg-[#141414] text-[#A3A3A3] hover:text-white'"
          >
            {{ tab.label }}
            <span class="ml-1 text-[10px] font-mono-data opacity-80">({{ getCount(tab.value) }})</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-[11px] text-[#737373] uppercase tracking-wider">Severity:</span>
          <select
            [(ngModel)]="riskFilter"
            class="bg-[#141414] border border-white/10 text-[#D4D4D4] text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#C5A059] cursor-pointer"
          >
            <option value="All">All Tiers</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>
        </div>
      </div>

      <!-- Alert Cards Grid -->
      <div *ngIf="filteredAlerts.length === 0">
        <app-empty-state
          icon="crisis_alert"
          title="No alerts match criteria"
          description="There are currently no fraud alerts matching the selected status and severity."
        ></app-empty-state>
      </div>

      <div *ngIf="filteredAlerts.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          *ngFor="let alert of filteredAlerts"
          class="bg-[#0D0D0D] border border-white/5 hover:border-[#C5A059]/30 rounded-xl p-5 space-y-4 transition-all group"
        >
          <!-- Top Row -->
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono-data font-bold text-white text-[13px] group-hover:text-[#C5A059] transition-colors">
                  {{ alert.id }}
                </span>
                <app-risk-badge [tier]="alert.riskTier"></app-risk-badge>
                <app-status-badge [status]="alert.status"></app-status-badge>
              </div>
              <div class="text-[11px] text-[#737373] mt-1 flex items-center gap-2">
                <span>{{ alert.createdAt }} at {{ alert.createdTime }}</span>
                <span>•</span>
                <span class="text-[#C5A059] font-mono-data">{{ alert.alertType }}</span>
              </div>
            </div>

            <div class="text-right font-mono-data">
              <div class="font-bold text-white text-[14px]">{{ alert.amountInr | inrCurrency:true }}</div>
              <div class="text-[11px] text-[#737373]">{{ alert.location }}</div>
            </div>
          </div>

          <!-- Reason -->
          <p class="text-[12px] text-[#D4D4D4] leading-relaxed bg-[#141414] p-3 rounded-lg border border-white/5">
            {{ alert.reason }}
          </p>

          <!-- Probability & Entity -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-[#737373]">Entity: <strong class="text-white">{{ alert.customerName }}</strong> ({{ alert.customerId }})</span>
              <span class="text-[#737373]">Ref: <strong class="text-white font-mono-data">{{ alert.transactionId }}</strong></span>
            </div>
            <app-probability-bar [value]="alert.fraudProbability" size="md"></app-probability-bar>
          </div>

          <!-- Card Actions -->
          <div class="flex items-center justify-between pt-2 border-t border-white/5">
            <span class="text-[11px] text-[#737373]">
              Assigned: <strong class="text-white">{{ alert.assignedTo || 'Unassigned' }}</strong>
            </span>
            <div class="flex items-center gap-2">
              <button
                *ngIf="alert.status !== 'Resolved'"
                (click)="resolveAlert(alert)"
                class="px-2.5 py-1 rounded bg-[#52b788]/15 hover:bg-[#52b788]/25 text-[#52b788] text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Mark Resolved
              </button>
              <button
                (click)="investigateAlert(alert)"
                class="px-3 py-1 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] rounded text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[14px]">psychology</span>
                <span>Investigate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </ng-container>
    </div>
  `
})
export class FraudAlertsComponent {
  activeTab: AlertStatus | 'All' = 'All';
  riskFilter: RiskTier | 'All' = 'All';

  readonly statusTabs: { label: string; value: AlertStatus | 'All' }[] = [
    { label: 'All Alerts', value: 'All' },
    { label: 'Open', value: 'Open' },
    { label: 'Investigating', value: 'Investigating' },
    { label: 'Escalated', value: 'Escalated' },
    { label: 'Resolved', value: 'Resolved' }
  ];

  constructor(
    public alertService: FraudAlertService,
    private transactionService: TransactionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.alertService.loadAlerts().subscribe();
  }

  get alerts(): FraudAlert[] {
    return this.alertService.getAlerts();
  }

  get filteredAlerts(): FraudAlert[] {
    let list = this.alerts;
    if (this.activeTab !== 'All') {
      list = list.filter(a => a.status === this.activeTab);
    }
    if (this.riskFilter !== 'All') {
      list = list.filter(a => a.riskTier === this.riskFilter);
    }
    return list;
  }

  getCount(tab: AlertStatus | 'All'): number {
    if (tab === 'All') return this.alerts.length;
    return this.alerts.filter(a => a.status === tab).length;
  }

  resolveAlert(alert: FraudAlert): void {
    this.alertService.resolveAlert(alert.id).subscribe();
  }

  investigateAlert(alert: FraudAlert): void {
    const txn = this.transactionService.getTransactionById(alert.transactionId);
    if (txn) {
      this.transactionService.selectTransaction(txn);
    }
    this.router.navigate(['/ai-investigator']);
  }
}
