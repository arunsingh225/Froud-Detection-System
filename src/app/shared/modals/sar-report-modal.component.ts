import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';
import { InrCurrencyPipe } from '../pipes/inr-currency.pipe';

type Step = 'review' | 'edit' | 'approved' | 'export';

@Component({
  selector: 'app-sar-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, InrCurrencyPipe],
  template: `
    <div
      *ngIf="modalService.sarModalOpen()"
      class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      (click)="close()"
    >
      <div
        class="bg-[#0D0D0D] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 pb-4 border-b border-white/5">
          <div>
            <h2 class="font-serif italic text-xl text-white">Generate SAR Draft</h2>
            <p class="text-[12px] text-[#737373] mt-0.5">
              This generates a draft for compliance review — not a formal regulatory submission.
            </p>
          </div>
          <button
            (click)="close()"
            class="p-2 rounded-full hover:bg-[#1A1A1A] text-[#737373] hover:text-white transition-colors cursor-pointer"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center gap-0 px-5 py-4 border-b border-white/5 overflow-x-auto">
          <ng-container *ngFor="let s of steps; let i = index">
            <div
              class="flex items-center gap-2 text-[11px] whitespace-nowrap"
              [ngClass]="i <= stepIdx ? 'text-[#C5A059]' : 'text-[#404040]'"
            >
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center border transition-all"
                [ngClass]="i < stepIdx ? 'bg-[#52b788]/20 border-[#52b788]/40 text-[#52b788]' :
                  (i === stepIdx ? 'bg-[#C5A059]/20 border-[#C5A059]/40 text-[#C5A059]' : 'bg-[#1A1A1A] border-white/5 text-[#404040]')"
              >
                <span *ngIf="i < stepIdx" class="material-symbols-outlined text-[14px]">check</span>
                <span *ngIf="i >= stepIdx" class="material-symbols-outlined text-[14px]">{{ s.icon }}</span>
              </div>
              <span class="font-medium hidden sm:inline">{{ s.label }}</span>
            </div>
            <div
              *ngIf="i < steps.length - 1"
              class="flex-1 h-px mx-3 min-w-[20px] transition-colors"
              [ngClass]="i < stepIdx ? 'bg-[#52b788]/40' : 'bg-white/5'"
            ></div>
          </ng-container>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <!-- Step 1: Review -->
          <ng-container *ngIf="step === 'review'">
            <div class="bg-[#141414] border border-[#C5A059]/25 rounded-xl p-4">
              <div class="flex items-center gap-2 text-[#C5A059] text-[11px] uppercase tracking-wider font-semibold mb-3">
                <span class="material-symbols-outlined text-[15px]">smart_toy</span>
                AI-Generated Draft (Review Before Proceeding)
              </div>
              <div class="grid grid-cols-2 gap-3 text-[12px] mb-3">
                <div>
                  <div class="text-[10px] text-[#737373] mb-0.5">Report Reference</div>
                  <div class="text-white font-medium font-mono-data text-[11px]">RPT-2026-0115</div>
                </div>
                <div>
                  <div class="text-[10px] text-[#737373] mb-0.5">Transaction</div>
                  <div class="text-white font-medium font-mono-data text-[11px]">{{ currentTxn?.id || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-[#737373] mb-0.5">Customer</div>
                  <div class="text-white font-medium">{{ currentTxn?.customerName || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-[#737373] mb-0.5">Amount</div>
                  <div class="text-white font-medium font-mono-data text-[11px]">{{ (currentTxn?.amountInr || 0) | inrCurrency:true }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-[#737373] mb-0.5">Risk Score</div>
                  <div class="text-white font-medium">{{ currentTxn?.probability || 0 }}% — {{ currentTxn?.riskTier || 'Unassessed' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-[#737373] mb-0.5">Generated</div>
                  <div class="text-white font-medium">Just now (Demo)</div>
                </div>
              </div>
            </div>

            <div class="bg-[#e05353]/5 border border-[#e05353]/20 rounded-xl p-4 text-[12px]">
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-[16px] text-[#ffb4ab] mt-0.5 shrink-0">info</span>
                <div class="text-[#A3A3A3] leading-relaxed">
                  <strong class="text-[#ffb4ab]">Important:</strong> This is a synthetic demo draft. No real SAR is being filed.
                  In production, this draft requires sign-off from a licensed compliance officer before any regulatory submission.
                </div>
              </div>
            </div>

            <button
              (click)="step = 'edit'"
              class="w-full py-2.5 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Review & Edit Narrative →
            </button>
          </ng-container>

          <!-- Step 2: Edit -->
          <ng-container *ngIf="step === 'edit'">
            <div>
              <label class="text-[11px] text-[#737373] uppercase tracking-wider block mb-2">SAR Narrative (Editable)</label>
              <textarea
                [(ngModel)]="narrative"
                class="w-full h-52 bg-[#141414] border border-white/10 focus:border-[#C5A059] rounded-xl px-4 py-3 text-[12px] text-[#D4D4D4] leading-relaxed resize-none outline-none transition-colors font-mono-data"
              ></textarea>
              <p class="text-[10px] text-[#737373] mt-1">{{ narrative.length }} characters · Edit before officer review</p>
            </div>
            <div class="flex gap-3">
              <button
                (click)="step = 'review'"
                class="flex-1 py-2.5 bg-[#141414] border border-white/10 text-[#A3A3A3] hover:text-white rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button
                (click)="step = 'approved'"
                class="flex-1 py-2.5 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Send for Officer Review →
              </button>
            </div>
          </ng-container>

          <!-- Step 3: Officer Sign-off -->
          <ng-container *ngIf="step === 'approved'">
            <div class="text-center py-6">
              <div class="w-14 h-14 rounded-2xl bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-[28px] text-[#C5A059]">gavel</span>
              </div>
              <h3 className="font-serif italic text-[18px] text-white mb-2">Awaiting Compliance Officer</h3>
              <p className="text-[13px] text-[#737373] max-w-sm mx-auto">
                In production, the compliance officer would review, edit, and digitally sign this draft before regulatory submission.
              </p>
            </div>

            <div class="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-2 text-[12px]">
              <div class="text-[10px] text-[#737373] uppercase tracking-wider mb-2">Officer Sign-off (Demo Simulation)</div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] text-[10px] font-bold">PI</div>
                <div>
                  <div class="text-white font-medium">Priyanka Iyer</div>
                  <div class="text-[10px] text-[#737373]">Chief Compliance Officer</div>
                </div>
                <span class="ml-auto text-[#C5A059] text-[10px] font-mono-data">PENDING</span>
              </div>
            </div>

            <div class="flex gap-3">
              <button
                (click)="step = 'edit'"
                class="flex-1 py-2.5 bg-[#141414] border border-white/10 text-[#A3A3A3] hover:text-white rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
              >
                ← Edit
              </button>
              <button
                (click)="step = 'export'"
                class="flex-1 py-2.5 bg-[#52b788]/80 hover:bg-[#52b788] text-white rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Simulate Approval →
              </button>
            </div>
          </ng-container>

          <!-- Step 4: Export -->
          <ng-container *ngIf="step === 'export'">
            <div class="text-center py-4">
              <div class="w-14 h-14 rounded-2xl bg-[#52b788]/10 border border-[#52b788]/30 flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-[28px] text-[#52b788]">task_alt</span>
              </div>
              <h3 className="font-serif italic text-[18px] text-white mb-2">Draft Approved (Demo)</h3>
              <p className="text-[12px] text-[#737373] max-w-sm mx-auto">
                This draft is saved in Reports. In production it would be submitted through the official regulatory portal after officer sign-off.
              </p>
            </div>

            <div class="bg-[#52b788]/5 border border-[#52b788]/20 rounded-xl p-4 text-[12px] space-y-2">
              <div *ngFor="let item of confirmationItems" class="flex items-center gap-2 text-[#52b788]">
                <span class="material-symbols-outlined text-[15px]">check_circle</span>
                {{ item }}
              </div>
            </div>

            <div class="flex gap-3">
              <button
                (click)="close()"
                class="flex-1 py-2.5 bg-[#141414] border border-white/10 text-[#A3A3A3] hover:text-white rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                (click)="downloadPdf()"
                class="flex-1 py-2.5 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[15px]">download</span>
                Export PDF (Demo)
              </button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `
})
export class SarReportModalComponent {
  step: Step = 'review';
  narrative: string = '';

  readonly steps: { id: Step; label: string; icon: string }[] = [
    { id: 'review', label: 'AI Draft', icon: 'smart_toy' },
    { id: 'edit', label: 'Review & Edit', icon: 'edit' },
    { id: 'approved', label: 'Officer Sign-off', icon: 'gavel' },
    { id: 'export', label: 'Export', icon: 'download' }
  ];

  readonly confirmationItems = [
    'Draft saved to Reports → RPT-2026-0115',
    'Audit trail entry created',
    'Compliance team notified (demo)'
  ];

  constructor(
    public modalService: ModalService,
    private transactionService: TransactionService
  ) {
    // Only initialize narrative when the modal is opened by user action
    effect(() => {
      if (this.modalService.sarModalOpen()) {
        this.step = 'review';
        this.initNarrative();
      }
    });
  }

  get currentTxn(): Transaction | null {
    return this.modalService.sarTargetTransaction() ||
           this.transactionService.selectedTransaction() ||
           (this.transactionService.transactions().length > 0 ? this.transactionService.transactions()[0] : null);
  }

  get stepIdx(): number {
    return this.steps.findIndex(s => s.id === this.step);
  }

  close(): void {
    this.step = 'review';
    this.modalService.closeSARModal();
  }

  downloadPdf(): void {
    this.close();
  }

  private initNarrative(): void {
    const txn = this.currentTxn;
    if (!txn) {
      this.narrative = 'Awaiting transaction evidence for SAR draft generation...';
      return;
    }
    const reportDate = txn.date ?? txn.timestamp ?? new Date().toLocaleDateString('en-IN');
    const amountStr = typeof txn.amountInr === 'number' ? `₹${txn.amountInr.toLocaleString('en-IN')}` : '₹0';
    const customer = txn.customerName || 'Unknown Customer';
    const customerId = txn.customerId || 'N/A';
    const target = txn.target || txn.merchant || 'Unknown Merchant';
    const anomaly = txn.anomalyReason || 'Flagged by behavioral anomaly detection rules';
    const vpn = txn.vpnDetected ? 'Yes' : 'No';
    const device = txn.device || 'Unspecified Device';

    this.narrative = `On ${reportDate}, a transaction of ${amountStr} was flagged for suspicious activity by the FraudGuard AI system. The transaction was initiated by customer ${customer} (ID: ${customerId}) and directed to ${target}. Key anomalies: ${anomaly}. VPN detected: ${vpn}. Device: ${device}. This report is prepared for compliance officer review and is not a formal regulatory filing.`;
  }
}
