import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvestigationService } from '../../services/investigation.service';
import { ModalService } from '../../services/modal.service';
import { TransactionService } from '../../services/transaction.service';
import { Investigation, TimelineStep, EvidenceCategory } from '../../models/investigation.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-investigation-detail',
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
              <span class="font-mono-data font-bold text-xl text-white">{{ inv.id }}</span>
              <app-risk-badge [tier]="inv.riskTier" size="md"></app-risk-badge>
              <app-status-badge [status]="inv.status" size="md"></app-status-badge>
            </div>
            <p class="text-[12px] text-[#737373] mt-0.5">
              Target: <strong class="text-white">{{ inv.customerName }}</strong> · Ref: {{ inv.transactionId }} · Investigator: {{ inv.assignedInvestigator }}
            </p>
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
          <a
            routerLink="/ai-investigator"
            class="px-4 py-2 rounded-lg bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_16px_rgba(197,160,89,0.25)] transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-[16px]">psychology</span>
            <span>AI Copilot</span>
          </a>
        </div>
      </div>

      <!-- Main Layout: 2 Columns (Left: Timeline & Evidence, Right: Decision Card) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Col 1 & 2: Timeline & Evidence -->
        <div class="lg:col-span-2 space-y-6">
          <!-- 8-Step Timeline -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-serif italic text-lg text-white">Investigation Lifecycle Timeline</h3>
              <span class="text-[11px] font-mono-data text-[#C5A059]">8 STEPS TOTAL</span>
            </div>

            <div class="space-y-4 pl-2">
              <div *ngFor="let step of timeline; let i = index; let last = last" class="flex gap-4 relative">
                <!-- Line connecting steps -->
                <div
                  *ngIf="!last"
                  class="absolute left-3.5 top-7 bottom-0 w-0.5"
                  [ngClass]="step.status === 'completed' ? 'bg-[#52b788]/40' : 'bg-white/10'"
                ></div>

                <!-- Icon circle -->
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-[12px]"
                  [ngClass]="step.status === 'completed' ? 'bg-[#52b788]/20 text-[#52b788] border border-[#52b788]/40' : (step.status === 'active' ? 'bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/40 pulse-dot' : 'bg-[#141414] text-[#737373] border border-white/5')"
                >
                  <span class="material-symbols-outlined text-[14px]">
                    {{ step.status === 'completed' ? 'check' : (step.status === 'active' ? 'play_arrow' : 'schedule') }}
                  </span>
                </div>

                <!-- Step Info -->
                <div class="flex-1 pb-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[13px] font-semibold text-white">{{ step.label }}</span>
                    <span class="text-[11px] text-[#737373] font-mono-data">{{ step.timestamp }}</span>
                  </div>
                  <p class="text-[12px] text-[#A3A3A3] mt-0.5 leading-relaxed">{{ step.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 6 Evidence Categories -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-lg text-white">Synthesized Evidence Vectors</h3>

            <div class="space-y-3">
              <div
                *ngFor="let cat of evidence"
                class="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-white font-medium text-[13px]">
                    <span class="material-symbols-outlined text-[18px] text-[#C5A059]">{{ cat.icon }}</span>
                    <span>{{ cat.category }} Vector</span>
                  </div>
                  <span class="text-[10px] text-[#737373] font-mono-data">{{ cat.items.length }} findings</span>
                </div>

                <div class="space-y-2">
                  <div
                    *ngFor="let item of cat.items"
                    class="p-2.5 rounded-lg bg-[#0D0D0D] border border-white/5 flex items-start justify-between gap-3 text-[12px]"
                  >
                    <div>
                      <div class="text-white font-semibold flex items-center gap-2">
                        <span>{{ item.type }}</span>
                        <span
                          class="text-[9px] px-1.5 py-0.2 rounded font-mono-data font-bold uppercase"
                          [ngClass]="item.severity === 'critical' ? 'bg-[#e05353]/20 text-[#ffb4ab]' : 'bg-[#C5A059]/20 text-[#C5A059]'"
                        >
                          {{ item.severity }}
                        </span>
                      </div>
                      <p class="text-[#A3A3A3] text-[11px] mt-0.5">{{ item.finding }}</p>
                      <div class="text-[10px] text-[#737373] mt-1 font-mono-data">
                        Source: {{ item.source }} • {{ item.timestamp }}
                      </div>
                    </div>

                    <div class="text-right font-mono-data text-[12px] text-[#52b788] shrink-0">
                      {{ item.confidence }}% conf.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Col 3: Human Decision Panel -->
        <div class="space-y-6">
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-lg text-white">Investigator Decision</h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Human-in-the-loop sign-off is mandatory before finalizing or submitting regulatory reports.
            </p>

            <div class="p-4 rounded-xl bg-[#141414] border border-white/5 space-y-3">
              <div class="flex justify-between text-[12px]">
                <span class="text-[#737373]">Case ID</span>
                <span class="text-white font-mono-data">{{ inv.id }}</span>
              </div>
              <div class="flex justify-between text-[12px]">
                <span class="text-[#737373]">Fraud Probability</span>
                <span class="text-[#ffb4ab] font-bold font-mono-data">{{ inv.fraudProbability }}%</span>
              </div>
              <div class="flex justify-between text-[12px]">
                <span class="text-[#737373]">Exposure</span>
                <span class="text-white font-mono-data">{{ inv.amountInr | inrCurrency:true }}</span>
              </div>
            </div>

            <!-- Decision buttons -->
            <div class="space-y-2">
              <button
                (click)="submitDecision('Approved')"
                class="w-full py-2.5 bg-[#52b788]/20 hover:bg-[#52b788]/30 text-[#52b788] border border-[#52b788]/40 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Approve (False Positive)</span>
              </button>

              <!-- Safety Change: Auto-Flag for Review instead of Auto-Freeze -->
              <button
                (click)="submitDecision('Pending Review')"
                class="w-full py-2.5 bg-[#C5A059]/20 hover:bg-[#C5A059]/30 text-[#C5A059] border border-[#C5A059]/40 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">flag</span>
                <span>Auto-Flag for Review</span>
              </button>

              <button
                (click)="submitDecision('Escalated')"
                class="w-full py-2.5 bg-[#e05353]/20 hover:bg-[#e05353]/30 text-[#ffb4ab] border border-[#e05353]/40 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">gavel</span>
                <span>Escalate for Compliance SAR</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class InvestigationDetailComponent implements OnInit {
  inv!: Investigation;
  timeline: TimelineStep[] = [];
  evidence: EvidenceCategory[] = [];
  toastMsg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private investigationService: InvestigationService,
    private transactionService: TransactionService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const match = this.investigationService.getInvestigationById(id);
      if (match) {
        this.inv = match;
        this.timeline = this.investigationService.timeline;
        this.evidence = this.investigationService.evidence;
        return;
      }
    }
    this.inv = this.investigationService.selectedInvestigation() || this.investigationService.investigations()[0];
    this.timeline = this.investigationService.timeline;
    this.evidence = this.investigationService.evidence;
  }

  goBack(): void {
    this.router.navigate(['/investigations']);
  }

  openSAR(): void {
    const txn = this.transactionService.getTransactionById(this.inv.transactionId);
    this.modalService.openSARModal(txn);
  }

  submitDecision(status: Investigation['status']): void {
    this.inv = { ...this.inv, status };
    this.showToast(`Decision recorded: Case marked as ${status}`);
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    setTimeout(() => {
      this.toastMsg = '';
    }, 3000);
  }
}
