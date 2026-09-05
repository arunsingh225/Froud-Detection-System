import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AIInvestigatorService } from '../../services/ai-investigator.service';
import { TransactionService } from '../../services/transaction.service';
import { ModalService } from '../../services/modal.service';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-ai-investigator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }
  `],
  template: `
    <div class="w-full min-h-full bg-[#0A0A0A] text-[#D4D4D4] p-4 lg:p-8 pb-12 space-y-6">
      <!-- Page Header & Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono-data uppercase text-[#C5A059] tracking-wider">
              AI-Assisted Investigation + Policy Retrieval
            </span>
            <span class="px-2 py-0.5 text-[10px] font-mono-data rounded bg-[#52b788]/15 text-[#52b788] border border-[#52b788]/30">
              Live Connected
            </span>
          </div>
          <h1 class="text-2xl font-serif font-bold text-white mt-1">Autonomous Fraud Investigation Workspace</h1>
          <p class="text-sm text-[#A3A3A3] mt-0.5">
            Multi-vector evidence synthesis, LightGBM neural inference, and local regulatory RAG policy grounding.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Transaction Selector -->
          <select
            [ngModel]="selectedTxnId"
            (ngModelChange)="onSelectTransaction($event)"
            class="bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-[#C5A059] focus:outline-none"
          >
            <option *ngFor="let t of transactions" [value]="t.transactionId">
              {{ t.transactionCode || t.id }} — ₹{{ t.amountInr | number }} ({{ t.merchant }})
            </option>
          </select>

          <button
            (click)="triggerInvestigation()"
            [disabled]="isGenerating || loading"
            class="px-4 py-2 bg-[#C5A059] hover:bg-[#dfba73] disabled:opacity-40 text-[#0A0A0A] font-bold rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#C5A059]/10"
          >
            <span *ngIf="loading || isGenerating" class="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
            <span *ngIf="!loading && !isGenerating" class="material-symbols-outlined text-[16px]">smart_toy</span>
            <span>{{ loading || isGenerating ? 'Synthesizing...' : 'Run AI Investigation' }}</span>
          </button>
        </div>
      </div>

      <!-- Error Alert -->
      <div *ngIf="error" class="p-4 rounded-xl bg-[#e05353]/15 border border-[#e05353]/30 text-[#ffb4ab] text-xs flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>{{ error }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="triggerInvestigation()" class="px-3 py-1 bg-[#e05353]/20 hover:bg-[#e05353]/30 rounded text-[11px] font-semibold cursor-pointer">
            Retry
          </button>
          <button (click)="aiService.error.set(null)" class="px-2 py-1 hover:bg-white/10 rounded text-[11px] font-semibold text-[#A3A3A3] hover:text-white cursor-pointer" title="Dismiss">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      </div>

      <!-- Human-in-the-Loop Advisory Banner -->
      <div class="bg-[#141414] border border-[#C5A059]/30 rounded-xl p-3.5 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] shrink-0">
          <span class="material-symbols-outlined text-[18px]">verified_user</span>
        </div>
        <div class="text-xs">
          <span class="text-[#C5A059] font-bold uppercase tracking-wider">Human-in-the-Loop Governance:</span>
          <span class="text-[#D4D4D4] ml-1">
            Autonomous financial actions (account freezes, payment rejections, SAR filings) are prohibited. All AI recommendations require human sign-off.
          </span>
        </div>
      </div>

      <!-- 3-Column Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left Column: Subject Dossier & Quick Prompts (3 cols) -->
        <div class="lg:col-span-3 space-y-4">
          <!-- Target Transaction Dossier Card -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider">Subject Case</span>
              <span class="text-[11px] font-mono-data font-bold text-[#C5A059]">{{ currentTxn?.id }}</span>
            </div>

            <div class="space-y-2 text-xs">
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Customer</span>
                <span class="text-white font-medium truncate max-w-[140px]">{{ currentTxn?.customerName }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Customer ID</span>
                <span class="text-white font-mono-data">{{ currentTxn?.customerId }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Amount</span>
                <span class="text-white font-mono-data font-bold">₹{{ currentTxn?.amountInr | number }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Merchant</span>
                <span class="text-[#D4D4D4]">{{ currentTxn?.merchant }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Payment Instrument</span>
                <span class="text-white">{{ currentTxn?.method }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Originating Location</span>
                <span class="text-[#D4D4D4]">{{ currentTxn?.location }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-[#737373]">Device Type</span>
                <span class="text-[#D4D4D4]">{{ currentTxn?.device }}</span>
              </div>
              <div class="flex justify-between py-1">
                <span class="text-[#737373]">Network Route</span>
                <span [ngClass]="currentTxn?.vpnDetected ? 'text-[#e05353] font-bold' : 'text-[#D4D4D4]'">
                  {{ currentTxn?.vpnDetected ? (currentTxn?.ip + ' (VPN Detected)') : (currentTxn?.ip || 'Direct ISP') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Quick Investigation Prompts -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-3">
            <span class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider block">
              Direct Copilot Inquiry
            </span>
            <div class="space-y-1.5">
              <button
                *ngFor="let p of quickPrompts"
                (click)="sendQuickPrompt(p.prompt)"
                class="w-full text-left p-2.5 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-[#C5A059]/30 text-[12px] text-[#D4D4D4] hover:text-[#C5A059] transition-all flex items-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px] text-[#C5A059] shrink-0">{{ p.icon }}</span>
                <span class="truncate">{{ p.label }}</span>
              </button>
            </div>
          </div>

          <!-- Retrieved RAG Policy Citations -->
          <div *ngIf="investigation?.policyReferences?.length" class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between border-b border-white/5 pb-2">
              <span class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider">
                RAG Citations ({{ investigation?.policyReferences?.length }})
              </span>
              <span class="text-[10px] text-[#52b788] font-mono-data">Zero Fabrication</span>
            </div>

            <div class="space-y-2.5">
              <div *ngFor="let cit of investigation?.policyReferences" class="p-2.5 rounded-lg bg-[#141414] border border-white/5 text-xs space-y-1">
                <div class="flex items-center gap-1 text-[#C5A059] font-medium text-[11px]">
                  <span class="material-symbols-outlined text-[14px]">menu_book</span>
                  <span class="truncate">{{ cit.source }}</span>
                </div>
                <p class="text-[11px] text-[#A3A3A3] italic leading-relaxed pl-3 border-l border-[#C5A059]/30">
                  "{{ cit.excerpt }}"
                </p>
                <div class="text-[9px] text-[#737373] font-mono-data pt-0.5">
                  Ref: {{ cit.chunkId }} ({{ cit.document }})
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Center Column: Executive Synthesis, Findings & Evidence (6 cols) -->
        <div class="lg:col-span-6 space-y-4">
          
          <!-- Loading State -->
          <div *ngIf="loading || isGenerating" class="bg-[#0D0D0D] border border-[#C5A059]/30 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div class="w-8 h-8 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
            <div class="text-sm font-semibold text-white">AI-Assisted Engine Synthesizing Multi-Vector Evidence…</div>
            <p class="text-xs text-[#A3A3A3] max-w-md">
              Evaluating financial baseline deviation, checking device fingerprint, matching IP against VPN registries, and querying regulatory RAG SOPs.
            </p>
          </div>

          <!-- AI Executive Investigation Summary -->
          <div *ngIf="investigation && !loading && !isGenerating" class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-3">
            <div class="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#C5A059] text-[20px]">psychology</span>
                <span class="text-sm font-semibold text-white">AI Executive Investigation Dossier</span>
              </div>
              <span class="text-xs font-mono-data text-[#C5A059]">Case {{ investigation.investigationCode }}</span>
            </div>

            <div class="p-3.5 rounded-lg bg-[#141414] border border-white/5 text-xs text-[#D4D4D4] leading-relaxed">
              {{ investigation.summary }}
            </div>

            <div class="p-2 rounded bg-white/5 text-[10px] text-[#737373] font-mono-data flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[13px] text-[#C5A059]">info</span>
              <span>Facts segregated from AI reasoning. Provider: Deterministic Template Engine (Safe fallback mode).</span>
            </div>
          </div>

          <!-- Key Suspicious Findings -->
          <div *ngIf="investigation?.findings?.length && !loading && !isGenerating" class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-3">
            <div class="flex items-center justify-between border-b border-white/5 pb-2">
              <span class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider">
                Suspicious Risk Indicators ({{ investigation?.findings?.length }})
              </span>
              <span class="text-[11px] font-mono-data text-[#e05353] font-bold">
                {{ investigation?.findings?.length }} Vector(s) Breached
              </span>
            </div>

            <div class="space-y-2.5">
              <div
                *ngFor="let f of investigation?.findings"
                class="p-3 rounded-lg bg-[#141414] border border-white/5 text-xs space-y-1.5"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 font-semibold text-white">
                    <span class="material-symbols-outlined text-[16px]" [ngClass]="f.severity === 'CRITICAL' ? 'text-[#e05353]' : 'text-[#C5A059]'">
                      {{ f.severity === 'CRITICAL' ? 'crisis_alert' : 'warning' }}
                    </span>
                    <span>{{ f.title }}</span>
                  </div>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-mono-data uppercase font-bold"
                    [ngClass]="f.severity === 'CRITICAL' ? 'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30' : 'bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30'"
                  >
                    {{ f.severity }}
                  </span>
                </div>
                <p class="text-[11px] text-[#A3A3A3] leading-relaxed pl-5">{{ f.explanation }}</p>
                <div *ngIf="f.evidenceIds?.length" class="pl-5 flex items-center gap-1 pt-1">
                  <span class="text-[9px] text-[#737373] font-mono-data">Evidence:</span>
                  <span *ngFor="let evId of f.evidenceIds" class="px-1.5 py-0.2 bg-white/5 text-white font-mono-data text-[9px] rounded">
                    {{ evId }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Multi-Vector Corroborating Evidence Table -->
          <div *ngIf="investigation?.evidence?.length && !loading && !isGenerating" class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-3">
            <div class="flex items-center justify-between border-b border-white/5 pb-2">
              <span class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider">
                Multi-Vector Evidence Dossier ({{ investigation?.evidence?.length }})
              </span>
              <span class="text-[10px] font-mono-data text-[#C5A059]">6-Pillar Framework</span>
            </div>

            <div class="space-y-2">
              <div
                *ngFor="let ev of investigation?.evidence"
                class="p-2.5 rounded-lg bg-[#141414] border border-white/5 flex items-start justify-between gap-3 text-xs"
              >
                <div class="space-y-0.5 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="px-1.5 py-0.5 bg-white/5 text-[#C5A059] font-mono-data text-[9px] rounded uppercase font-bold">
                      {{ ev.category }}
                    </span>
                    <span class="font-medium text-white text-[12px]">{{ ev.findingType }}</span>
                  </div>
                  <p class="text-[11px] text-[#A3A3A3] leading-relaxed">{{ ev.findingDetail }}</p>
                  <div class="text-[9px] text-[#737373] font-mono-data">Source: {{ ev.source }}</div>
                </div>

                <div class="text-right shrink-0">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-mono-data uppercase font-bold"
                    [ngClass]="{
                      'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30': ev.severity === 'critical',
                      'bg-[#dfba73]/15 text-[#dfba73] border border-[#dfba73]/30': ev.severity === 'high',
                      'bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30': ev.severity === 'medium',
                      'bg-white/5 text-[#737373]': ev.severity === 'low' || ev.severity === 'info'
                    }"
                  >
                    {{ ev.severity }}
                  </span>
                  <div class="text-[10px] font-mono-data text-[#737373] mt-1">{{ ev.confidence | number:'1.0-0' }}% conf</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Neural Score Gauge & Human Decision Authority (3 cols) -->
        <div class="lg:col-span-3 space-y-4">
          
          <!-- Neural Gauge Card -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 text-center space-y-4">
            <h3 class="font-serif italic text-lg text-white">Neural Anomaly Score</h3>

            <div class="relative w-36 h-36 mx-auto flex items-center justify-center">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1A1A1A" stroke-width="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  [attr.stroke]="scoreColor"
                  stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="251.2"
                  [attr.stroke-dashoffset]="251.2 - (251.2 * fraudScore / 100)"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-3xl font-bold font-mono-data text-white">{{ fraudScore | number:'1.1-1' }}%</span>
                <span
                  class="text-[10px] uppercase font-mono-data font-bold mt-0.5"
                  [ngClass]="fraudScore >= 80 ? 'text-[#ffb4ab]' : 'text-[#C5A059]'"
                >
                  {{ investigation?.riskTier || currentTxn?.riskTier || 'EVALUATING' }}
                </span>
              </div>
            </div>

            <div class="text-[11px] text-[#A3A3A3] leading-relaxed">
              Operating Threshold: <strong>80.00%</strong>. Supervised LightGBM inference with 464 engineered features.
            </div>
          </div>

          <!-- AI Recommended Action Card -->
          <div class="bg-[#0D0D0D] border border-[#C5A059]/30 rounded-xl p-4 space-y-2 text-center">
            <span class="text-[10px] font-mono-data text-[#737373] uppercase tracking-wider block">
              AI Recommended Course of Action
            </span>
            <div class="p-2.5 rounded-lg bg-[#141414] border border-[#C5A059]/25 text-xs font-bold text-[#C5A059]">
              {{ investigation?.recommendedAction || 'ESCALATE_FOR_MANUAL_REVIEW' }}
            </div>
            <p class="text-[11px] text-[#A3A3A3]">
              Confidence: <strong>{{ (investigation?.confidence || 0.9) * 100 | number:'1.0-0' }}%</strong>
            </p>
          </div>

          <!-- Human Review & Final Decision Actions -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-3">
            <div class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider">
              Human Review & Action Authority
            </div>
            <p class="text-[11px] text-[#A3A3A3] leading-relaxed">
              AI agent advises course of action; final legal & financial decision authority rests with human investigator.
            </p>

            <div *ngIf="decisionSubmitted" class="p-3 rounded-lg bg-[#52b788]/15 border border-[#52b788]/30 text-[#52b788] text-xs flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Decision recorded: <strong>{{ lastDecision }}</strong></span>
            </div>

            <div class="space-y-2 pt-1">
              <button
                (click)="onAction('Approved')"
                [disabled]="loading"
                class="w-full py-2.5 bg-[#52b788]/15 hover:bg-[#52b788]/25 text-[#52b788] border border-[#52b788]/30 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Approve Transaction</span>
              </button>

              <button
                (click)="onAction('Auto-Flag for Review')"
                [disabled]="loading"
                class="w-full py-2.5 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-[#C5A059] border border-[#C5A059]/30 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span class="material-symbols-outlined text-[16px]">flag</span>
                <span>Auto-Flag for Review</span>
              </button>

              <button
                (click)="onAction('Escalated')"
                [disabled]="loading"
                class="w-full py-2.5 bg-[#e05353]/15 hover:bg-[#e05353]/25 text-[#ffb4ab] border border-[#e05353]/30 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span class="material-symbols-outlined text-[16px]">gavel</span>
                <span>Escalate to Compliance</span>
              </button>

              <button
                (click)="onAction('Rejected')"
                [disabled]="loading"
                class="w-full py-2.5 bg-[#141414] hover:bg-[#1C1C1C] text-[#A3A3A3] hover:text-white border border-white/10 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span class="material-symbols-outlined text-[16px]">cancel</span>
                <span>Reject Transaction</span>
              </button>
            </div>
          </div>

          <!-- Auditable Investigation Timeline -->
          <div *ngIf="investigation?.timeline?.length" class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-3">
            <span class="text-[11px] font-mono-data text-[#737373] uppercase tracking-wider block">
              Auditable Investigation Lifecycle
            </span>

            <div class="space-y-3 pl-1">
              <div *ngFor="let step of investigation?.timeline" class="flex items-start gap-2.5 text-xs">
                <span
                  class="material-symbols-outlined text-[16px] shrink-0 mt-0.5"
                  [ngClass]="step.status === 'completed' ? 'text-[#52b788]' : 'text-[#C5A059] animate-pulse'"
                >
                  {{ step.status === 'completed' ? 'check_circle' : 'pending' }}
                </span>
                <div class="space-y-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="font-semibold text-white text-[11px]">{{ step.label }}</span>
                    <span class="px-1 py-0.2 bg-white/5 text-[9px] font-mono-data rounded uppercase text-[#A3A3A3]">
                      {{ step.actorType }}
                    </span>
                  </div>
                  <p class="text-[10px] text-[#737373] leading-relaxed">{{ step.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class AiInvestigatorComponent implements OnInit {
  selectedTxnId = '';
  inputText = '';
  decisionSubmitted = false;
  lastDecision = '';

  readonly quickPrompts = [
    { label: 'Check Device Integrity & Root', prompt: 'Analyze device fingerprint and root status for this transaction.', icon: 'devices' },
    { label: 'Verify IP Geolocation & VPN', prompt: 'Check geolocation, VPN exit nodes, and distance from typical location.', icon: 'location_on' },
    { label: 'Calculate Velocity Ratio', prompt: 'Compute velocity spike relative to 90-day baseline.', icon: 'speed' },
    { label: 'Review AML/KYC SOP Guidance', prompt: 'Query compliance policy regarding suspicious structuring thresholds.', icon: 'description' }
  ];

  constructor(
    public aiService: AIInvestigatorService,
    public transactionService: TransactionService,
    public modalService: ModalService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const selected = this.transactionService.selectedTransaction();
    if (selected?.transactionId) {
      this.selectedTxnId = selected.transactionId;
    }

    // If transactions aren't loaded yet, load them
    if (!this.transactionService.transactions().length) {
      this.transactionService.loadTransactions().subscribe({
        next: (txns) => {
          if (txns.length) {
            if (!this.selectedTxnId) {
              const target = this.transactionService.selectedTransaction() || txns[0];
              this.handleInitialSelection(target.transactionId || '');
            } else {
              this.handleInitialSelection(this.selectedTxnId);
            }
          }
        }
      });
    } else {
      const target = this.transactionService.selectedTransaction() || this.transactionService.transactions()[0];
      this.handleInitialSelection(this.selectedTxnId || (target?.transactionId || ''));
    }
  }

  private handleInitialSelection(defaultId: string): void {
    const queryId = this.route.snapshot.queryParamMap.get('txnId');
    if (queryId) {
      const match = this.transactions.find(
        t => t.id.toLowerCase() === queryId.toLowerCase() ||
             t.transactionCode?.toLowerCase() === queryId.toLowerCase() ||
             t.transactionId?.toLowerCase() === queryId.toLowerCase()
      );
      this.selectedTxnId = match?.transactionId || queryId;
    } else {
      this.selectedTxnId = defaultId;
    }
    // Automatically trigger initial AI synthesis
    this.triggerInvestigation();
  }

  get transactions(): Transaction[] {
    return this.transactionService.transactions();
  }

  get currentTxn(): Transaction | undefined {
    return this.transactions.find(t =>
      (t.transactionId && t.transactionId === this.selectedTxnId) ||
      t.id === this.selectedTxnId ||
      t.transactionCode === this.selectedTxnId
    ) || this.transactions[0];
  }

  get investigation() {
    return this.aiService.activeInvestigation();
  }

  get loading(): boolean {
    return this.aiService.loading();
  }

  get isGenerating(): boolean {
    return this.aiService.isGenerating();
  }

  get error(): string | null {
    return this.aiService.error();
  }

  get fraudScore(): number {
    return this.investigation?.fraudProbability ?? this.currentTxn?.probability ?? 82.4;
  }

  get scoreColor(): string {
    const s = this.fraudScore;
    if (s >= 80) return '#e05353';
    if (s >= 50) return '#C5A059';
    return '#52b788';
  }

  onSelectTransaction(txnId: string): void {
    this.selectedTxnId = txnId;
    this.decisionSubmitted = false;
    this.aiService.error.set(null);
    this.triggerInvestigation();
  }

  triggerInvestigation(): void {
    this.aiService.error.set(null);
    const txns = this.transactions;
    if (!txns || !txns.length) {
      console.warn('[AI Investigator] Transactions list is empty; cannot run investigation.');
      return;
    }

    const txn = this.currentTxn || txns[0];
    if (!txn) return;

    // Resolve target GUID strictly. NEVER send human-readable "TXN-2026-xxxx"
    let targetGuid: string | null = null;
    if (txn.transactionId && this.isGuid(txn.transactionId)) {
      targetGuid = txn.transactionId;
    } else if (this.isGuid(this.selectedTxnId)) {
      targetGuid = this.selectedTxnId;
    } else if (this.isGuid(txn.id)) {
      targetGuid = txn.id;
    } else {
      // Find transaction by code or id and retrieve its GUID
      const match = txns.find(t =>
        t.transactionCode === this.selectedTxnId ||
        t.id === this.selectedTxnId ||
        t.transactionCode === txn.id ||
        t.transactionCode === txn.transactionCode
      );
      if (match?.transactionId && this.isGuid(match.transactionId)) {
        targetGuid = match.transactionId;
      }
    }

    if (!targetGuid) {
      const err = `Cannot trigger investigation: No valid database GUID found for ${txn.transactionCode || txn.id}.`;
      console.error('[AI Investigator]', err);
      this.aiService.error.set(err);
      return;
    }

    console.log(`[AI Investigator] Executing AI investigation for ${txn.transactionCode || txn.id} with verified GUID: ${targetGuid}`);
    this.decisionSubmitted = false;
    this.aiService.runInvestigation(targetGuid).subscribe();
  }

  private isGuid(str?: string | null): boolean {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  sendQuickPrompt(prompt: string): void {
    if (this.currentTxn) {
      this.aiService.error.set(null);
      this.aiService.sendMessage(prompt, this.currentTxn);
    }
  }

  onAction(decision: string): void {
    if (!this.investigation) return;
    this.aiService.submitDecision(this.investigation.investigationId, decision).subscribe({
      next: () => {
        this.decisionSubmitted = true;
        this.lastDecision = decision;
        // Also update local transaction status
        if (this.currentTxn) {
          const mappedStatus = decision === 'Approved' ? 'Approved' : decision === 'Rejected' ? 'Rejected' : 'Investigating';
          this.transactionService.updateStatus(this.currentTxn.id, mappedStatus);
        }
      }
    });
  }
}
