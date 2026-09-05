import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TransactionService } from '../../services/transaction.service';
import { ModalService } from '../../services/modal.service';
import { Transaction } from '../../models/transaction.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-transaction-detail',
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
      <!-- Toast feedback -->
      <div
        *ngIf="toastMsg"
        class="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#C5A059] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in"
      >
        <span class="material-symbols-outlined text-[#C5A059]">task_alt</span>
        <span class="text-[13px]">{{ toastMsg }}</span>
      </div>

      <!-- Top Back & Nav -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <button
            (click)="goBack()"
            class="p-2 rounded-lg bg-[#141414] border border-white/5 hover:border-[#C5A059] text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono-data font-bold text-xl text-white">{{ txn.id }}</span>
              <app-risk-badge [tier]="txn.riskTier" size="md"></app-risk-badge>
              <app-status-badge [status]="txn.status" size="md"></app-status-badge>
            </div>
            <p class="text-[12px] text-[#737373] mt-0.5">{{ txn.date }} at {{ txn.time }} · {{ txn.location }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            (click)="openSAR()"
            class="px-3.5 py-2 rounded-lg bg-[#141414] border border-white/10 hover:border-[#C5A059] text-[12px] text-[#D4D4D4] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span class="material-symbols-outlined text-[16px] text-[#C5A059]">description</span>
            <span>Draft SAR</span>
          </button>
          <button
            (click)="investigateWithAI()"
            class="px-4 py-2 rounded-lg bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_16px_rgba(197,160,89,0.25)] transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-[16px]">psychology</span>
            <span>Launch AI Agent</span>
          </button>
        </div>
      </div>

      <!-- Anomaly Alert Banner -->
      <div
        class="border rounded-xl p-4 flex items-start gap-3"
        [ngClass]="txn.probability > 75 ? 'bg-[#e05353]/10 border-[#e05353]/30 text-[#ffb4ab]' : 'bg-[#C5A059]/10 border-[#C5A059]/30 text-[#C5A059]'"
      >
        <span class="material-symbols-outlined text-[20px] mt-0.5 shrink-0">
          {{ txn.probability > 75 ? 'crisis_alert' : 'warning' }}
        </span>
        <div class="text-[13px] leading-relaxed">
          <strong class="font-semibold">Anomaly Flagged:</strong> {{ txn.anomalyReason }}
        </div>
      </div>

      <!-- Main 3-Column Dossier -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Col 1: Transaction Summary -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
          <h3 class="font-serif italic text-lg text-white">Financial Details</h3>

          <div class="p-4 rounded-xl bg-[#141414] border border-white/5 text-center">
            <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">Transaction Amount</div>
            <div class="font-mono-data font-bold text-2xl text-white">{{ txn.amountInr | inrCurrency:true }}</div>
            <div *ngIf="txn.amountUsd" class="text-[12px] text-[#C5A059] font-mono-data mt-0.5">
              ≈ \${{ txn.amountUsd.toLocaleString() }} USD
            </div>
          </div>

          <div class="space-y-3 text-[12px]">
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Merchant</span>
              <span class="text-white font-medium">{{ txn.merchant }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Category</span>
              <span class="text-white font-medium">{{ txn.merchantCategory }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Payment Method</span>
              <span class="text-white font-mono-data">{{ txn.method }}</span>
            </div>
            <div *ngIf="txn.mcc" class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">MCC Code</span>
              <span class="text-white font-mono-data">{{ txn.mcc }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Timestamp</span>
              <span class="text-white font-mono-data">{{ txn.timestamp }}</span>
            </div>
          </div>
        </div>

        <!-- Col 2: Telemetry & Device -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
          <h3 class="font-serif italic text-lg text-white">Session Telemetry</h3>

          <div class="space-y-3 text-[12px]">
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Location</span>
              <span class="text-white font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-[#C5A059]">pin_drop</span>
                {{ txn.location }}
              </span>
            </div>
            <div *ngIf="txn.distanceFromTypical" class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Distance from Normal</span>
              <span class="text-[#ffb4ab] font-mono-data">{{ txn.distanceFromTypical }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">IP Address</span>
              <span class="text-white font-mono-data">{{ txn.ip }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">VPN / Proxy</span>
              <span
                class="font-semibold px-2 py-0.5 rounded text-[11px]"
                [ngClass]="txn.vpnDetected ? 'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30' : 'bg-[#52b788]/15 text-[#52b788]'"
              >
                {{ txn.vpnDetected ? 'DETECTED' : 'NOT DETECTED' }}
              </span>
            </div>
            <div class="flex justify-between py-1 border-b border-white/5">
              <span class="text-[#737373]">Device Fingerprint</span>
              <span class="text-white truncate max-w-[160px]">{{ txn.device }}</span>
            </div>
          </div>
        </div>

        <!-- Col 3: Customer Intelligence & Action -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-serif italic text-lg text-white">Customer Dossier</h3>
              <a [routerLink]="['/customers', txn.customerId]" class="text-[11px] text-[#C5A059] hover:underline uppercase tracking-wider">
                360 Profile →
              </a>
            </div>

            <div class="p-3 bg-[#141414] rounded-lg border border-white/5 flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] font-bold">
                {{ customerInitials }}
              </div>
              <div class="overflow-hidden">
                <div class="font-semibold text-white truncate">{{ txn.customerName }}</div>
                <div class="text-[11px] text-[#737373] font-mono-data">{{ txn.customerId }}</div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="text-[11px] text-[#737373] uppercase tracking-wider">Investigator Actions</div>
              <div class="grid grid-cols-1 gap-2">
                <button
                  (click)="updateStatus('Approved')"
                  class="w-full py-2 bg-[#52b788]/15 hover:bg-[#52b788]/25 text-[#52b788] border border-[#52b788]/30 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Clear & Approve Transaction</span>
                </button>
                <button
                  (click)="updateStatus('Escalated')"
                  class="w-full py-2 bg-[#e05353]/15 hover:bg-[#e05353]/25 text-[#ffb4ab] border border-[#e05353]/30 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[16px]">flag</span>
                  <span>Escalate to Tier-2 Review</span>
                </button>
              </div>
            </div>
          </div>

          <div class="text-[11px] text-[#737373] text-center pt-2 border-t border-white/5">
            Audit trail records all actions taken on this record.
          </div>
        </div>
      </div>
    </div>
  `
})
export class TransactionDetailComponent implements OnInit {
  txn!: Transaction;
  toastMsg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private transactionService: TransactionService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const match = this.transactionService.getTransactionById(id);
      if (match) {
        this.txn = match;
        return;
      }
    }
    this.txn = this.transactionService.selectedTransaction() || this.transactionService.transactions()[0];
  }

  get customerInitials(): string {
    return this.txn.customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  goBack(): void {
    this.router.navigate(['/transactions']);
  }

  openSAR(): void {
    this.modalService.openSARModal(this.txn);
  }

  investigateWithAI(): void {
    this.transactionService.selectTransaction(this.txn);
    this.router.navigate(['/ai-investigator']);
  }

  updateStatus(status: Transaction['status']): void {
    this.transactionService.updateStatus(this.txn.id, status).subscribe({
      next: () => {
        this.txn = { ...this.txn, status };
        this.showToast(`Transaction ${this.txn.id} status updated to: ${status}`);
      },
      error: (err: Error) => {
        this.showToast(`Failed to update status: ${err.message}`);
      }
    });
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    setTimeout(() => {
      this.toastMsg = '';
    }, 3000);
  }
}
