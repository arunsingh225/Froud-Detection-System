import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InvestigationService } from '../../services/investigation.service';
import { ModalService } from '../../services/modal.service';
import { Investigation } from '../../models/investigation.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-investigations-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    RiskBadgeComponent,
    StatusBadgeComponent,
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
      <!-- Loading State -->
      <div *ngIf="investigationService.loading()" class="flex items-center justify-center py-16">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
          <span class="text-[13px] text-[#737373]">Loading investigations…</span>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="investigationService.error()" class="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-red-400 text-[20px]">error</span>
          <span class="text-[13px] text-red-300">{{ investigationService.error() }}</span>
        </div>
        <button
          (click)="refreshData()"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-[11px] font-semibold uppercase tracking-[0.1em] transition-all cursor-pointer whitespace-nowrap"
        >
          <span class="material-symbols-outlined text-[14px]">refresh</span>
          Retry
        </button>
      </div>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight">Investigation Center</h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Active fraud dossiers, multi-source evidence synthesis, and human-in-the-loop decisions.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            (click)="refreshData()"
            class="flex items-center gap-2 bg-[#141414] hover:bg-[#1a1a1a] text-[#A3A3A3] hover:text-white px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.15em] transition-all border border-white/5 active:scale-95 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[17px]">refresh</span>
            <span>Refresh</span>
          </button>

          <button
            (click)="modalService.openNewInvestigationModal()"
            class="flex items-center gap-2 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.15em] transition-all shadow-[0_0_16px_rgba(197,160,89,0.25)] active:scale-95 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[17px]">add</span>
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div class="flex items-center bg-[#141414] rounded-lg px-3 py-1.5 border border-white/10 focus-within:border-[#C5A059] transition-all flex-1 min-w-[200px]">
          <span class="material-symbols-outlined text-[#737373] text-[16px] mr-2">search</span>
          <input
            type="text"
            [(ngModel)]="search"
            placeholder="Search by case ID, customer name, transaction…"
            class="bg-transparent border-none text-[13px] text-[#D4D4D4] placeholder-[#737373] w-full focus:outline-none"
          />
        </div>

        <select
          [(ngModel)]="statusFilter"
          class="bg-[#141414] border border-white/10 text-[#D4D4D4] text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#C5A059] cursor-pointer"
        >
          <option value="All">All Statuses</option>
          <option value="New">New</option>
          <option value="Investigating">Investigating</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      <!-- Table -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl overflow-hidden">
        <div *ngIf="filteredInvestigations.length === 0">
          <app-empty-state
            icon="find_in_page"
            title="No investigations found"
            description="Try changing the search or status filter."
          ></app-empty-state>
        </div>

        <div *ngIf="filteredInvestigations.length > 0" class="overflow-x-auto">
          <table class="w-full text-left text-[13px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] text-[10px] uppercase tracking-[0.12em]">
                <th class="pl-4 py-3">Case ID</th>
                <th class="py-3 pr-3">Target Customer</th>
                <th class="py-3 pr-3">Transaction</th>
                <th class="py-3 pr-3">Amount</th>
                <th class="py-3 pr-3">Risk Tier</th>
                <th class="py-3 pr-3">Assigned Investigator</th>
                <th class="py-3 pr-3">Status</th>
                <th class="py-3 pr-3">Last Updated</th>
                <th class="py-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr
                *ngFor="let inv of filteredInvestigations"
                (click)="onSelect(inv)"
                class="hover:bg-[#141414] transition-colors group cursor-pointer"
              >
                <td class="pl-4 py-3">
                  <div class="font-mono-data font-bold text-white group-hover:text-[#C5A059] transition-colors text-[12px]">
                    {{ inv.id }}
                  </div>
                  <div class="text-[10px] text-[#737373]">{{ inv.createdDate }}</div>
                </td>
                <td class="py-3 pr-3">
                  <div class="text-white font-medium text-[12px]">{{ inv.customerName }}</div>
                  <div class="text-[10px] text-[#737373] font-mono-data">{{ inv.customerId }}</div>
                </td>
                <td class="py-3 pr-3">
                  <div class="font-mono-data text-white text-[12px]">{{ inv.transactionId }}</div>
                  <div class="text-[10px] text-[#737373] truncate max-w-[130px]">{{ inv.location }}</div>
                </td>
                <td class="py-3 pr-3 font-mono-data font-bold text-white">
                  {{ inv.amountInr | inrCurrency:true }}
                </td>
                <td class="py-3 pr-3">
                  <app-risk-badge [tier]="inv.riskTier"></app-risk-badge>
                </td>
                <td class="py-3 pr-3">
                  <div class="flex items-center gap-1.5">
                    <span class="w-5 h-5 rounded-full bg-[#C5A059]/20 text-[#C5A059] flex items-center justify-center text-[9px] font-bold">
                      {{ inv.assignedInvestigator.slice(0, 2).toUpperCase() }}
                    </span>
                    <span class="text-white text-[12px]">{{ inv.assignedInvestigator }}</span>
                  </div>
                </td>
                <td class="py-3 pr-3">
                  <app-status-badge [status]="inv.status"></app-status-badge>
                </td>
                <td class="py-3 pr-3 text-[12px] text-[#737373] font-mono-data">
                  {{ inv.lastUpdated }}
                </td>
                <td class="py-3 pr-4 text-right" (click)="$event.stopPropagation()">
                  <button
                    (click)="onSelect(inv)"
                    class="px-2.5 py-1 bg-[#141414] hover:bg-[#C5A059] text-[#A3A3A3] hover:text-[#0A0A0A] border border-white/5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Open Dossier →
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class InvestigationsListComponent implements OnInit {
  search = '';
  statusFilter = 'All';

  constructor(
    public investigationService: InvestigationService,
    public modalService: ModalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.investigationService.loadInvestigations().subscribe();
  }

  refreshData(): void {
    this.investigationService.loadInvestigations().subscribe();
  }

  get investigations(): Investigation[] {
    return this.investigationService.investigations();
  }

  get filteredInvestigations(): Investigation[] {
    let list = this.investigations;
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      list = list.filter(i =>
        i.id.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.transactionId.toLowerCase().includes(q) ||
        i.assignedInvestigator.toLowerCase().includes(q)
      );
    }
    if (this.statusFilter !== 'All') {
      list = list.filter(i => i.status === this.statusFilter);
    }
    return list;
  }

  onSelect(inv: Investigation): void {
    this.investigationService.selectInvestigation(inv);
    this.router.navigate(['/investigations', inv.id]);
  }
}
