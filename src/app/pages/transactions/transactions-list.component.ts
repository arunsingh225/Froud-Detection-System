import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TransactionService } from '../../services/transaction.service';
import { ModalService } from '../../services/modal.service';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Transaction } from '../../models/transaction.model';
import { RiskTier } from '../../models/types.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ProbabilityBarComponent } from '../../shared/components/probability-bar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

type SortKey = 'id' | 'amountInr' | 'probability' | 'timestamp';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-transactions-list',
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
      <!-- Loading State -->
      <div *ngIf="transactionService.loading()" class="flex items-center justify-center py-16">
        <div class="flex items-center gap-3 text-[#C5A059]">
          <div class="w-5 h-5 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
          <span class="text-[13px]">Loading transactions from backend...</span>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="transactionService.error() && !transactionService.loading()" class="bg-[#e05353]/10 border border-[#e05353]/30 rounded-xl p-4 flex items-center gap-3">
        <span class="material-symbols-outlined text-[#e05353]">error</span>
        <span class="text-[13px] text-[#ffb4ab]">{{ transactionService.error() }}</span>
        <button (click)="refreshData()" class="ml-auto px-3 py-1 bg-[#141414] border border-white/10 rounded-lg text-[11px] text-[#C5A059] cursor-pointer hover:border-[#C5A059]">Retry</button>
      </div>

      <!-- Export Error Alert -->
      <div *ngIf="exportError" class="bg-[#e05353]/10 border border-[#e05353]/30 rounded-xl p-3 flex items-center justify-between text-xs text-[#ffb4ab]">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px]">error</span>
          <span>{{ exportError }}</span>
        </div>
        <button (click)="exportError = null" class="text-[#ffb4ab] hover:text-white cursor-pointer">
          <span class="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>

      <ng-container *ngIf="!transactionService.loading()">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight">Transactions</h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            {{ filtered.length }} transactions · sorted by {{ sortKey }} {{ sortDir }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span *ngIf="selectedRows.size > 0" class="text-[12px] text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-3 py-1.5 rounded-lg">
            {{ selectedRows.size }} selected
          </span>
          <button *ngIf="authService.hasAnyRole(['ADMIN', 'INVESTIGATOR'])" (click)="modalService.openNewTransactionModal()" class="flex items-center gap-1.5 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] px-3.5 py-2 rounded-lg text-[12px] font-semibold tracking-wide transition-all shadow-[0_0_12px_rgba(197,160,89,0.25)] cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>Ingest Transaction</span>
          </button>
          <button (click)="refreshData()" class="flex items-center gap-2 bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 text-[#D4D4D4] px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer">
            <span class="material-symbols-outlined text-[16px] text-[#C5A059]">refresh</span>
            <span>Refresh</span>
          </button>
          <button
            (click)="exportTransactions()"
            [disabled]="isExporting"
            class="flex items-center gap-2 bg-[#141414] hover:bg-[#1C1C1C] disabled:opacity-50 border border-white/10 text-[#D4D4D4] px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
          >
            <span *ngIf="isExporting" class="w-3.5 h-3.5 border-2 border-[#C5A059]/40 border-t-[#C5A059] rounded-full animate-spin"></span>
            <span *ngIf="!isExporting" class="material-symbols-outlined text-[16px] text-[#C5A059]">download</span>
            <span>{{ isExporting ? 'Exporting...' : 'Export' }}</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <!-- Search -->
        <div class="flex items-center bg-[#141414] rounded-lg px-3 py-1.5 border border-white/10 focus-within:border-[#C5A059] transition-all flex-1 min-w-[200px]">
          <span class="material-symbols-outlined text-[#737373] text-[16px] mr-2">search</span>
          <input
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="page = 0"
            placeholder="Search ID, customer, merchant, location…"
            class="bg-transparent border-none text-[13px] text-[#D4D4D4] placeholder-[#737373] w-full focus:outline-none"
          />
          <button *ngIf="search" (click)="search = ''; page = 0" class="text-[#737373] hover:text-white cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <!-- Risk Filter -->
        <select
          [(ngModel)]="riskFilter"
          (ngModelChange)="page = 0"
          class="bg-[#141414] border border-white/10 text-[#D4D4D4] text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#C5A059] cursor-pointer"
        >
          <option value="All">All Risks</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <!-- Status Filter -->
        <select
          [(ngModel)]="statusFilter"
          (ngModelChange)="page = 0"
          class="bg-[#141414] border border-white/10 text-[#D4D4D4] text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#C5A059] cursor-pointer"
        >
          <option value="All">All Statuses</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Investigating">Investigating</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>

        <button
          *ngIf="search || riskFilter !== 'All' || statusFilter !== 'All'"
          (click)="clearFilters()"
          class="text-[12px] text-[#C5A059] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span class="material-symbols-outlined text-[14px]">filter_list_off</span>
          Clear filters
        </button>
      </div>

      <!-- Table -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl overflow-hidden">
        <div *ngIf="paged.length === 0">
          <app-empty-state
            icon="receipt_long"
            title="No transactions found"
            description="Try adjusting your search or filters to find transactions."
            actionLabel="Clear filters"
            (actionClick)="clearFilters()"
          ></app-empty-state>
        </div>

        <div *ngIf="paged.length > 0" class="overflow-x-auto">
          <table class="w-full text-left text-[13px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] text-[10px] uppercase tracking-[0.12em]">
                <th class="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    [checked]="allPagedSelected"
                    (change)="toggleSelectAll()"
                    class="accent-[#C5A059] cursor-pointer"
                  />
                </th>
                <th class="py-3 pr-3 cursor-pointer hover:text-white transition-colors" (click)="toggleSort('id')">
                  <div class="flex items-center gap-1">
                    Txn ID
                    <span class="material-symbols-outlined text-[14px]" [ngClass]="sortKey === 'id' ? 'text-[#C5A059]' : 'text-[#404040]'">
                      {{ sortKey === 'id' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                    </span>
                  </div>
                </th>
                <th class="py-3 pr-3">Customer</th>
                <th class="py-3 pr-3 cursor-pointer hover:text-white transition-colors" (click)="toggleSort('amountInr')">
                  <div class="flex items-center gap-1">
                    Amount
                    <span class="material-symbols-outlined text-[14px]" [ngClass]="sortKey === 'amountInr' ? 'text-[#C5A059]' : 'text-[#404040]'">
                      {{ sortKey === 'amountInr' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                    </span>
                  </div>
                </th>
                <th class="py-3 pr-3">Merchant</th>
                <th class="py-3 pr-3">Location</th>
                <th class="py-3 pr-3">Device</th>
                <th class="py-3 pr-3 cursor-pointer hover:text-white transition-colors" (click)="toggleSort('probability')">
                  <div class="flex items-center gap-1">
                    Fraud Prob
                    <span class="material-symbols-outlined text-[14px]" [ngClass]="sortKey === 'probability' ? 'text-[#C5A059]' : 'text-[#404040]'">
                      {{ sortKey === 'probability' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                    </span>
                  </div>
                </th>
                <th class="py-3 pr-3">Risk</th>
                <th class="py-3 pr-3">Status</th>
                <th class="py-3 pr-3 cursor-pointer hover:text-white transition-colors text-right" (click)="toggleSort('timestamp')">
                  <div class="flex items-center gap-1 justify-end">
                    Time
                    <span class="material-symbols-outlined text-[14px]" [ngClass]="sortKey === 'timestamp' ? 'text-[#C5A059]' : 'text-[#404040]'">
                      {{ sortKey === 'timestamp' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                    </span>
                  </div>
                </th>
                <th class="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr
                *ngFor="let txn of paged"
                (click)="onSelect(txn)"
                class="hover:bg-[#141414] transition-colors group cursor-pointer"
                [ngClass]="isRowSelected(txn) ? 'bg-[#C5A059]/5 border-l-2 border-l-[#C5A059]' : ''"
              >
                <td class="pl-4 py-3" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="isRowSelected(txn)"
                    (change)="toggleRow(txn)"
                    class="accent-[#C5A059] cursor-pointer"
                  />
                </td>
                <td class="py-3 pr-3">
                  <div class="font-mono-data font-bold text-white group-hover:text-[#C5A059] transition-colors text-[12px]">
                    {{ txn.id }}
                  </div>
                  <div class="text-[10px] text-[#737373] font-mono-data">{{ txn.method }}</div>
                </td>
                <td class="py-3 pr-3">
                  <div class="font-medium text-white text-[12px] truncate max-w-[120px]">{{ txn.customerName }}</div>
                  <div class="text-[10px] text-[#737373] font-mono-data">{{ txn.customerId }}</div>
                </td>
                <td class="py-3 pr-3 font-mono-data">
                  <div class="font-bold text-white text-[13px]">{{ txn.amountInr | inrCurrency:true }}</div>
                  <div *ngIf="txn.amountUsd" class="text-[10px] text-[#737373]">\${{ txn.amountUsd.toLocaleString() }}</div>
                </td>
                <td class="py-3 pr-3 max-w-[110px]">
                  <div class="text-white text-[12px] truncate">{{ txn.merchant }}</div>
                  <div class="text-[10px] text-[#737373] truncate">{{ txn.merchantCategory }}</div>
                </td>
                <td class="py-3 pr-3">
                  <div class="flex items-center gap-1 text-[12px] text-white">
                    <span class="material-symbols-outlined text-[13px] text-[#C5A059]">pin_drop</span>
                    <span class="truncate max-w-[90px]">{{ txn.location }}</span>
                  </div>
                  <div *ngIf="txn.vpnDetected" class="text-[10px] text-[#e05353] font-mono-data flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[11px]">vpn_lock</span> VPN
                  </div>
                </td>
                <td class="py-3 pr-3 max-w-[100px]">
                  <div class="text-[11px] text-[#A3A3A3] truncate">{{ txn.device.split('/')[0].trim() }}</div>
                </td>
                <td class="py-3 pr-3 min-w-[120px]">
                  <app-probability-bar [value]="txn.probability"></app-probability-bar>
                </td>
                <td class="py-3 pr-3">
                  <app-risk-badge [tier]="txn.riskTier"></app-risk-badge>
                </td>
                <td class="py-3 pr-3">
                  <app-status-badge [status]="txn.status"></app-status-badge>
                </td>
                <td class="py-3 pr-3 text-right">
                  <div class="text-[11px] text-[#A3A3A3] font-mono-data whitespace-nowrap">{{ txn.time }}</div>
                  <div class="text-[10px] text-[#737373]">{{ txn.date }}</div>
                </td>
                <td class="py-3 pr-4 text-right" (click)="$event.stopPropagation()">
                  <div class="flex items-center gap-1 justify-end">
                    <button
                      (click)="onSelect(txn)"
                      class="p-1.5 rounded hover:bg-[#C5A059]/10 text-[#737373] hover:text-[#C5A059] transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <span class="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                    <button
                      (click)="onInvestigate(txn)"
                      class="p-1.5 rounded hover:bg-[#C5A059]/10 text-[#737373] hover:text-[#C5A059] transition-colors cursor-pointer"
                      title="Investigate with AI"
                    >
                      <span class="material-symbols-outlined text-[16px]">psychology</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div *ngIf="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-white/5 text-[12px] text-[#737373]">
          <span>Showing {{ page * perPage + 1 }}–{{ Math.min((page + 1) * perPage, filtered.length) }} of {{ filtered.length }}</span>
          <div class="flex items-center gap-1">
            <button
              (click)="page = Math.max(0, page - 1)"
              [disabled]="page === 0"
              class="px-2.5 py-1 rounded bg-[#141414] border border-white/10 hover:border-[#C5A059] disabled:opacity-40 transition-colors cursor-pointer"
            >
              ←
            </button>
            <button
              *ngFor="let p of pagesArray; let i = index"
              (click)="page = i"
              class="w-7 h-7 rounded text-[11px] font-mono-data transition-colors cursor-pointer"
              [ngClass]="i === page ? 'bg-[#C5A059] text-[#0A0A0A] font-bold' : 'bg-[#141414] border border-white/10 hover:border-[#C5A059] text-[#A3A3A3]'"
            >
              {{ i + 1 }}
            </button>
            <button
              (click)="page = Math.min(totalPages - 1, page + 1)"
              [disabled]="page === totalPages - 1"
              class="px-2.5 py-1 rounded bg-[#141414] border border-white/10 hover:border-[#C5A059] disabled:opacity-40 transition-colors cursor-pointer"
            >
              →
            </button>
          </div>
        </div>
      </div>
      </ng-container>
    </div>
  `
})
export class TransactionsListComponent implements OnInit {
  search = '';
  riskFilter: RiskTier | 'All' = 'All';
  statusFilter = 'All';
  sortKey: SortKey = 'timestamp';
  sortDir: SortDir = 'desc';
  page = 0;
  perPage = 6;
  selectedRows = new Set<string>();
  isExporting = false;
  exportError: string | null = null;

  Math = Math;

  constructor(
    public transactionService: TransactionService,
    public modalService: ModalService,
    public authService: AuthService,
    public analyticsService: AnalyticsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.transactionService.loadTransactions().subscribe();
  }

  getCanonicalId(txn: Transaction): string {
    return txn.transactionId || txn.id;
  }

  isRowSelected(txn: Transaction): boolean {
    return this.selectedRows.has(this.getCanonicalId(txn));
  }

  get filtered(): Transaction[] {
    let data = [...this.transactionService.getTransactions()];
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      data = data.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.customerId.toLowerCase().includes(q) ||
        t.merchant.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q)
      );
    }
    if (this.riskFilter !== 'All') data = data.filter(t => t.riskTier === this.riskFilter);
    if (this.statusFilter !== 'All') data = data.filter(t => t.status === this.statusFilter);

    data.sort((a, b) => {
      let av: any = a[this.sortKey];
      let bv: any = b[this.sortKey];
      if (this.sortKey === 'timestamp') {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      return this.sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

    return data;
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.perPage);
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  get paged(): Transaction[] {
    return this.filtered.slice(this.page * this.perPage, (this.page + 1) * this.perPage);
  }

  get allPagedSelected(): boolean {
    return this.paged.length > 0 && this.paged.every(t => this.isRowSelected(t));
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'desc';
    }
  }

  toggleRow(txn: Transaction): void {
    const id = this.getCanonicalId(txn);
    if (this.selectedRows.has(id)) {
      this.selectedRows.delete(id);
    } else {
      this.selectedRows.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.allPagedSelected) {
      this.paged.forEach(t => this.selectedRows.delete(this.getCanonicalId(t)));
    } else {
      this.paged.forEach(t => this.selectedRows.add(this.getCanonicalId(t)));
    }
  }

  exportTransactions(): void {
    if (this.isExporting) return;
    this.isExporting = true;
    this.exportError = null;

    this.analyticsService.exportData('transactions', 'csv').subscribe({
      next: (blob: Blob) => {
        this.isExporting = false;
        if (!blob || blob.size === 0) {
          this.exportError = 'Export failed: Received empty file from server.';
          return;
        }
        const today = new Date().toISOString().split('T')[0];
        const filename = `fraudguard-transactions-${today}.csv`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.isExporting = false;
        console.error('[TransactionsList] Export failed:', err);
        if (err.status === 403) {
          this.exportError = 'Access Denied: You do not possess the required permissions to export transactions.';
        } else if (err.status === 401) {
          this.exportError = 'Authentication expired. Please log in again.';
        } else {
          this.exportError = 'Failed to export transactions. Please try again.';
        }
      }
    });
  }

  clearFilters(): void {
    this.search = '';
    this.riskFilter = 'All';
    this.statusFilter = 'All';
    this.page = 0;
  }

  onSelect(txn: Transaction): void {
    this.transactionService.selectTransaction(txn);
    this.router.navigate(['/transactions', txn.id]);
  }

  onInvestigate(txn: Transaction): void {
    this.transactionService.selectTransaction(txn);
    this.router.navigate(['/ai-investigator']);
  }
}
