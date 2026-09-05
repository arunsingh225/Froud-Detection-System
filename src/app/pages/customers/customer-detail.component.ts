import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CustomerService } from '../../services/customer.service';
import { TransactionService } from '../../services/transaction.service';
import { FraudAlertService } from '../../services/fraud-alert.service';
import { Customer } from '../../models/customer.model';
import { Transaction } from '../../models/transaction.model';
import { FraudAlert } from '../../models/alert.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, RiskBadgeComponent, StatusBadgeComponent, InrCurrencyPipe],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }
  `],
  template: `
    <div class="w-full min-h-full bg-[#0A0A0A] text-[#D4D4D4] p-4 lg:p-8 pb-12 space-y-6">
      <!-- Back Header -->
      <div class="flex items-center gap-3">
        <button
          (click)="goBack()"
          class="p-2 rounded-lg bg-[#141414] border border-white/5 hover:border-[#C5A059] text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-serif italic text-2xl text-white">{{ customer.name }}</span>
            <app-risk-badge [tier]="customer.riskTier" size="md"></app-risk-badge>
            <app-status-badge [status]="customer.status" size="md"></app-status-badge>
          </div>
          <p class="text-[12px] text-[#737373] mt-0.5 font-mono-data">
            ID: {{ customer.id }} · Customer since {{ customer.customerSince }} · {{ customer.city }}
          </p>
        </div>
      </div>

      <!-- 4 Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">Risk Score</div>
          <div class="text-2xl font-bold font-mono-data text-white flex items-center justify-between">
            <span>{{ customer.riskScore }}/100</span>
            <span class="text-[11px] font-mono-data uppercase px-2 py-0.5 rounded" [ngClass]="customer.riskScore > 75 ? 'bg-[#e05353]/15 text-[#ffb4ab]' : 'bg-[#52b788]/15 text-[#52b788]'">
              {{ customer.riskTier }}
            </span>
          </div>
        </div>

        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">30-Day Volume</div>
          <div class="text-2xl font-bold font-mono-data text-white">
            {{ customer.vol30d | inrCurrency:true }}
          </div>
        </div>

        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">Avg Transaction</div>
          <div class="text-2xl font-bold font-mono-data text-white">
            {{ customer.avgTxn | inrCurrency:true }}
          </div>
        </div>

        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">KYC & Identity</div>
          <div class="text-lg font-bold text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-[#52b788] text-[20px]">verified</span>
            <span>{{ customer.kycStatus }}</span>
            <span *ngIf="customer.pan" class="text-[11px] text-[#737373] font-mono-data font-normal">({{ customer.pan }})</span>
          </div>
        </div>
      </div>

      <!-- Tabs: Transactions / Alerts -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-b border-white/5 pb-2">
          <button
            (click)="activeTab = 'txns'"
            class="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
            [ngClass]="activeTab === 'txns' ? 'bg-[#C5A059] text-[#0A0A0A] font-bold' : 'text-[#737373] hover:text-white'"
          >
            Transaction History ({{ relatedTransactions.length }})
          </button>
          <button
            (click)="activeTab = 'alerts'"
            class="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
            [ngClass]="activeTab === 'alerts' ? 'bg-[#C5A059] text-[#0A0A0A] font-bold' : 'text-[#737373] hover:text-white'"
          >
            Associated Alerts ({{ relatedAlerts.length }})
          </button>
        </div>

        <!-- Transactions Sub-table -->
        <div *ngIf="activeTab === 'txns'" class="bg-[#0D0D0D] border border-white/5 rounded-xl overflow-hidden">
          <table class="w-full text-left text-[13px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] text-[10px] uppercase tracking-wider">
                <th class="p-4">Txn ID</th>
                <th class="p-4">Merchant</th>
                <th class="p-4">Amount</th>
                <th class="p-4">Location</th>
                <th class="p-4">Risk Probability</th>
                <th class="p-4">Status</th>
                <th class="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr *ngFor="let txn of relatedTransactions" class="hover:bg-[#141414] transition-colors">
                <td class="p-4 font-mono-data font-bold text-white">{{ txn.id }}</td>
                <td class="p-4 text-white">{{ txn.merchant }}</td>
                <td class="p-4 font-mono-data text-white font-bold">{{ txn.amountInr | inrCurrency:true }}</td>
                <td class="p-4">{{ txn.location }}</td>
                <td class="p-4 font-mono-data" [ngClass]="txn.probability > 75 ? 'text-[#ffb4ab]' : 'text-[#52b788]'">
                  {{ txn.probability }}%
                </td>
                <td class="p-4">
                  <app-status-badge [status]="txn.status"></app-status-badge>
                </td>
                <td class="p-4 text-right">
                  <a [routerLink]="['/transactions', txn.id]" class="text-[11px] text-[#C5A059] hover:underline uppercase tracking-wider">
                    View →
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Alerts Sub-table -->
        <div *ngIf="activeTab === 'alerts'" class="bg-[#0D0D0D] border border-white/5 rounded-xl overflow-hidden">
          <table class="w-full text-left text-[13px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] text-[10px] uppercase tracking-wider">
                <th class="p-4">Alert ID</th>
                <th class="p-4">Type</th>
                <th class="p-4">Amount</th>
                <th class="p-4">Severity</th>
                <th class="p-4">Reason</th>
                <th class="p-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr *ngFor="let alt of relatedAlerts" class="hover:bg-[#141414] transition-colors">
                <td class="p-4 font-mono-data font-bold text-white">{{ alt.id }}</td>
                <td class="p-4 text-white">{{ alt.alertType }}</td>
                <td class="p-4 font-mono-data text-white font-bold">{{ alt.amountInr | inrCurrency:true }}</td>
                <td class="p-4">
                  <app-risk-badge [tier]="alt.riskTier"></app-risk-badge>
                </td>
                <td class="p-4 text-[#A3A3A3] max-w-xs truncate">{{ alt.reason }}</td>
                <td class="p-4">
                  <app-status-badge [status]="alt.status"></app-status-badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class CustomerDetailComponent implements OnInit {
  customer!: Customer;
  activeTab: 'txns' | 'alerts' = 'txns';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService,
    private transactionService: TransactionService,
    private alertService: FraudAlertService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const match = this.customerService.getCustomerById(id);
      if (match) {
        this.customer = match;
        return;
      }
    }
    this.customer = this.customerService.selectedCustomer() || this.customerService.customers()[0];
  }

  get relatedTransactions(): Transaction[] {
    return this.transactionService.getTransactions().filter(
      t => t.customerId.toLowerCase() === this.customer.id.toLowerCase()
    );
  }

  get relatedAlerts(): FraudAlert[] {
    return this.alertService.getAlerts().filter(
      a => a.customerId.toLowerCase() === this.customer.id.toLowerCase()
    );
  }

  goBack(): void {
    this.router.navigate(['/customers']);
  }
}
