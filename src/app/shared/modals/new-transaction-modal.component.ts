import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalService } from '../../services/modal.service';
import { TransactionService } from '../../services/transaction.service';
import { CustomerService } from '../../services/customer.service';
import { FraudAlertService } from '../../services/fraud-alert.service';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { CreateTransactionDto, TransactionDto } from '../../models/api-response.model';

@Component({
  selector: 'app-new-transaction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="modalService.newTransactionModalOpen()"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      (click)="close()"
    >
      <div
        class="bg-[#0D0D0D] border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl relative text-[#D4D4D4] max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <button
          (click)="close()"
          class="absolute top-4 right-4 text-[#737373] hover:text-white p-1 rounded-lg cursor-pointer"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <!-- Header -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#141414] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.2)]">
            <span class="material-symbols-outlined text-[22px]">add_card</span>
          </div>
          <div>
            <h3 class="font-serif italic text-2xl text-white tracking-tight">Ingest New Transaction</h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Dispatches transaction to ASP.NET Core & resident LightGBM AI Engine for real-time fraud scoring.
            </p>
          </div>
        </div>

        <!-- Compliance Notice Banner -->
        <div *ngIf="isCompliance" class="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-300 text-xs animate-in fade-in">
          <span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">policy</span>
          <div>
            <div class="font-semibold text-amber-200">Compliance Oversight Mode</div>
            <div class="text-amber-300/80 mt-0.5 leading-relaxed">
              Compliance officers possess oversight privileges and cannot directly ingest transactions. Ingestion is restricted to Investigators and Administrators under enterprise policy.
            </div>
          </div>
        </div>

        <!-- In-Modal Error Banner -->
        <div *ngIf="errorMessage" class="p-3.5 bg-[#e05353]/10 border border-[#e05353]/30 rounded-xl flex items-start gap-3 text-[#ffb4ab] text-xs animate-in fade-in">
          <span class="material-symbols-outlined text-[#e05353] text-[20px] shrink-0 mt-0.5">error</span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-white">Transaction Request Not Allowed</div>
            <div class="mt-0.5 leading-relaxed">{{ errorMessage }}</div>
          </div>
          <button (click)="errorMessage = null" class="text-[#ffb4ab] hover:text-white cursor-pointer ml-2">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <!-- Result Banner if Evaluated -->
        <div *ngIf="evalResult" class="p-4 rounded-xl border space-y-3"
          [ngClass]="evalResult.riskTier === 'Critical' || evalResult.riskTier === 'High' ? 'bg-[#e05353]/10 border-[#e05353]/30 text-[#ffb4ab]' : 'bg-[#52b788]/10 border-[#52b788]/30 text-[#52b788]'"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[22px]">
                {{ evalResult.riskTier === 'Critical' || evalResult.riskTier === 'High' ? 'crisis_alert' : 'verified_user' }}
              </span>
              <span class="font-bold text-[14px]">
                Fraud Assessment Result: {{ evalResult.riskTier.toUpperCase() }} RISK
              </span>
            </div>
            <span class="font-mono-data text-xs bg-black/40 px-2.5 py-1 rounded-md">
              {{ evalResult.transactionCode }}
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div class="p-2 bg-black/30 rounded-lg">
              <div class="text-[#A3A3A3] text-[10px] uppercase">Fraud Probability</div>
              <div class="font-bold text-white text-[14px] font-mono-data">{{ evalResult.probability.toFixed(2) }}%</div>
            </div>
            <div class="p-2 bg-black/30 rounded-lg">
              <div class="text-[#A3A3A3] text-[10px] uppercase">Risk Tier</div>
              <div class="font-bold text-white text-[14px]">{{ evalResult.riskTier }}</div>
            </div>
            <div class="p-2 bg-black/30 rounded-lg">
              <div class="text-[#A3A3A3] text-[10px] uppercase">Decision</div>
              <div class="font-bold text-white text-[14px]">{{ evalResult.status === 'Investigating' ? 'Flagged for Review' : 'Approved' }}</div>
            </div>
            <div class="p-2 bg-black/30 rounded-lg">
              <div class="text-[#A3A3A3] text-[10px] uppercase">Alert Created</div>
              <div class="font-bold text-[14px]" [ngClass]="evalResult.status === 'Investigating' ? 'text-[#ffb4ab]' : 'text-[#52b788]'">
                {{ evalResult.status === 'Investigating' ? 'YES (Open)' : 'NO' }}
              </div>
            </div>
          </div>

          <div class="text-[11px] text-[#A3A3A3] flex items-center justify-between border-t border-white/5 pt-2">
            <span>Model: <b>LightGBM_Fraud_Classifier</b> · Threshold: <b>80%</b></span>
            <span>Status: <b class="text-white">{{ evalResult.status }}</b></span>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-2 pt-2">
            <button
              (click)="viewCreatedTransaction()"
              class="px-3.5 py-1.5 bg-[#141414] hover:bg-[#1C1C1C] border border-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[16px] text-[#C5A059]">visibility</span>
              <span>View Transaction</span>
            </button>
            <button
              *ngIf="evalResult.status === 'Investigating'"
              (click)="viewFraudAlerts()"
              class="px-3.5 py-1.5 bg-[#e05353]/20 hover:bg-[#e05353]/30 border border-[#e05353]/40 text-[#ffb4ab] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[16px]">warning</span>
              <span>View Fraud Alert</span>
            </button>
          </div>
        </div>

        <!-- Form (visible when not evaluated or to submit another) -->
        <div *ngIf="!evalResult" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1">
                Transaction Amount (INR ₹)
              </label>
              <input
                type="number"
                [(ngModel)]="form.amountInr"
                placeholder="50000"
                class="w-full bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#C5A059] font-mono-data"
              />
            </div>

            <div>
              <label class="text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1">
                Payment Method
              </label>
              <select
                [(ngModel)]="form.paymentMethod"
                class="w-full bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#C5A059] cursor-pointer"
              >
                <option value="Visa Credit">Visa Credit Card</option>
                <option value="Mastercard Debit">Mastercard Debit</option>
                <option value="UPI">UPI / Instant Transfer</option>
                <option value="Wire Transfer">RTGS / Wire Transfer</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1">
                Card Last 4 Digits
              </label>
              <input
                type="text"
                [(ngModel)]="form.cardLast4"
                placeholder="4321"
                maxlength="4"
                class="w-full bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#C5A059] font-mono-data"
              />
            </div>

            <div>
              <label class="text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1">
                Location (City / Country)
              </label>
              <input
                type="text"
                [(ngModel)]="form.city"
                placeholder="Mumbai"
                class="w-full bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1">
                Distance From Typical (km)
              </label>
              <input
                type="number"
                [(ngModel)]="form.distanceFromTypicalKm"
                placeholder="15"
                class="w-full bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#C5A059] font-mono-data"
              />
            </div>

            <div class="flex items-center gap-3 pt-6">
              <label class="flex items-center gap-2 cursor-pointer select-none text-[12px] text-[#D4D4D4]">
                <input
                  type="checkbox"
                  [(ngModel)]="form.vpnOrProxyDetected"
                  class="w-4 h-4 rounded border-white/20 bg-[#141414] text-[#C5A059] focus:ring-0 cursor-pointer"
                />
                <span>VPN / Anonymous Proxy Detected</span>
              </label>
            </div>
          </div>

          <!-- Quick Test Presets -->
          <div class="pt-2 border-t border-white/5 space-y-2">
            <span class="text-[10px] font-mono-data text-[#737373] uppercase tracking-widest block">
              Quick Test Scenarios:
            </span>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                (click)="applyPreset('normal')"
                class="p-2 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-[#52b788]/40 text-[#52b788] text-left transition-colors cursor-pointer"
              >
                <b>Normal Transaction</b> (₹1,500, Local, No VPN)
              </button>
              <button
                type="button"
                (click)="applyPreset('suspicious')"
                class="p-2 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-[#e05353]/40 text-[#ffb4ab] text-left transition-colors cursor-pointer"
              >
                <b>Suspicious Anomaly</b> (₹8,50,000, Foreign, VPN)
              </button>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex justify-end gap-3 pt-3 border-t border-white/5">
          <button
            (click)="close()"
            class="px-4 py-2 bg-[#141414] hover:bg-[#1C1C1C] text-white rounded-lg text-[11px] uppercase tracking-wider font-semibold border border-white/10 cursor-pointer"
          >
            {{ evalResult ? 'Done' : 'Cancel' }}
          </button>

          <button
            *ngIf="evalResult"
            (click)="evalResult = null"
            class="px-4 py-2 bg-[#141414] hover:bg-[#1C1C1C] text-[#C5A059] rounded-lg text-[11px] uppercase tracking-wider font-semibold border border-[#C5A059]/30 cursor-pointer"
          >
            Submit Another
          </button>

          <button
            *ngIf="!evalResult"
            (click)="submitTransaction()"
            [disabled]="isSubmitting || !form.amountInr || !canIngest"
            [title]="!canIngest ? 'Transaction ingestion is restricted to ADMIN and INVESTIGATOR roles' : ''"
            class="px-5 py-2.5 bg-[#C5A059] hover:bg-[#dfba73] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] font-bold uppercase tracking-[0.15em] rounded-lg text-[11px] transition-all shadow-[0_0_16px_rgba(197,160,89,0.25)] flex items-center gap-2 cursor-pointer"
          >
            <ng-container *ngIf="isSubmitting; else readyBtn">
              <div class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              <span>Evaluating via AI Engine...</span>
            </ng-container>
            <ng-template #readyBtn>
              <span class="material-symbols-outlined text-[16px]">bolt</span>
              <span>Submit for AI Assessment</span>
            </ng-template>
          </button>
        </div>
      </div>
    </div>
  `
})
export class NewTransactionModalComponent implements OnInit {
  isSubmitting = false;
  evalResult: TransactionDto | null = null;
  errorMessage: string | null = null;

  form: CreateTransactionDto = {
    accountId: '44444444-4444-4444-4444-444444444401',
    customerId: '33333333-3333-3333-3333-333333333301',
    amountInr: 50000,
    paymentMethod: 'Visa Credit',
    cardLast4: '4421',
    ipAddress: '103.12.44.188',
    city: 'Mumbai',
    country: 'India',
    distanceFromTypicalKm: 12,
    vpnOrProxyDetected: false
  };

  constructor(
    public modalService: ModalService,
    public authService: AuthService,
    private transactionService: TransactionService,
    private customerService: CustomerService,
    private fraudAlertService: FraudAlertService,
    private analyticsService: AnalyticsService,
    private router: Router
  ) {}

  get canIngest(): boolean {
    return this.authService.hasAnyRole(['ADMIN', 'INVESTIGATOR']);
  }

  get isCompliance(): boolean {
    return this.authService.userRole() === 'COMPLIANCE';
  }

  ngOnInit(): void {
    // Pick existing account and customer from store if available
    const cust = this.customerService.customers()[0];
    if (cust && (cust as any).customerId) {
      this.form.customerId = (cust as any).customerId;
    }
  }

  applyPreset(type: 'normal' | 'suspicious'): void {
    this.errorMessage = null;
    if (type === 'normal') {
      this.form.amountInr = 1500;
      this.form.paymentMethod = 'UPI';
      this.form.cardLast4 = '1234';
      this.form.city = 'Mumbai';
      this.form.country = 'India';
      this.form.distanceFromTypicalKm = 5;
      this.form.vpnOrProxyDetected = false;
    } else {
      this.form.amountInr = 850000;
      this.form.paymentMethod = 'Visa Credit';
      this.form.cardLast4 = '9988';
      this.form.city = 'Moscow';
      this.form.country = 'Russia';
      this.form.distanceFromTypicalKm = 5200;
      this.form.vpnOrProxyDetected = true;
    }
  }

  submitTransaction(): void {
    if (!this.form.amountInr || this.form.amountInr <= 0) return;
    if (!this.canIngest) {
      this.errorMessage = 'Access Denied: You do not possess the required permissions (ADMIN or INVESTIGATOR required) for this action.';
      return;
    }

    this.errorMessage = null;
    this.isSubmitting = true;

    this.transactionService.createTransaction(this.form).subscribe({
      next: res => {
        this.isSubmitting = false;
        if (res && res.success && res.data) {
          this.evalResult = res.data;
          // Refresh alerts, transactions, dashboard, and live queue
          this.fraudAlertService.loadAlerts().subscribe();
          this.analyticsService.loadDashboardData();
          this.analyticsService.getLiveAlerts(10).subscribe();
        }
      },
      error: err => {
        this.isSubmitting = false;
        if (err.status === 403) {
          this.errorMessage = 'Access Denied: You do not possess the required permissions (ADMIN or INVESTIGATOR required) for this action.';
        } else {
          this.errorMessage = err.error?.message || err.message || 'Transaction submission failed. Please check input data.';
        }
      }
    });
  }

  viewCreatedTransaction(): void {
    if (this.evalResult) {
      const id = this.evalResult.transactionCode || this.evalResult.transactionId;
      this.close();
      this.router.navigate(['/transactions', id]);
    }
  }

  viewFraudAlerts(): void {
    this.close();
    this.router.navigate(['/fraud-alerts']);
  }

  close(): void {
    this.modalService.closeNewTransactionModal();
    this.evalResult = null;
    this.errorMessage = null;
  }
}
