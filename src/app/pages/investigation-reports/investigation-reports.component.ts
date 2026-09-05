import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../services/analytics.service';
import { ModalService } from '../../services/modal.service';
import { InvestigationReport } from '../../models/report.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-investigation-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RiskBadgeComponent, StatusBadgeComponent, EmptyStateComponent],
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
      <div
        *ngIf="analyticsService.loading()"
        class="flex flex-col items-center justify-center py-20 gap-4"
      >
        <div class="w-10 h-10 border-4 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
        <span class="text-[13px] text-[#737373] font-mono-data tracking-wide">Loading reports…</span>
      </div>

      <!-- Error State -->
      <div
        *ngIf="analyticsService.error() && !analyticsService.loading()"
        class="bg-[#1a0a0a] border border-[#e05353]/30 rounded-xl p-5 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[#e05353]">error</span>
          <span class="text-[13px] text-[#ffb4ab]">{{ analyticsService.error() }}</span>
        </div>
        <button
          (click)="refreshData()"
          class="flex items-center gap-1.5 bg-[#141414] hover:bg-[#1C1C1C] text-[#C5A059] border border-[#C5A059]/30 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-colors cursor-pointer"
        >
          <span class="material-symbols-outlined text-[14px]">refresh</span>
          Retry
        </button>
      </div>

     <ng-container *ngIf="!analyticsService.loading() && !analyticsService.error()">
      <!-- Toast feedback -->
      <div
        *ngIf="toastMsg"
        class="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#C5A059] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in"
      >
        <span class="material-symbols-outlined text-[#C5A059]">task_alt</span>
        <span class="text-[13px]">{{ toastMsg }}</span>
      </div>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight">Compliance & SAR Reports</h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            FinCEN Form 111 drafts, AML audit summaries, and suspicious activity filings.
          </p>
        </div>

        <button
          (click)="modalService.openSARModal()"
          class="flex items-center gap-2 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.15em] transition-all shadow-[0_0_16px_rgba(197,160,89,0.25)] active:scale-95 cursor-pointer"
        >
          <span class="material-symbols-outlined text-[17px]">description</span>
          <span>Draft New SAR</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-2 border-b border-white/5 pb-3">
        <button
          *ngFor="let cat of categories"
          (click)="selectedCat = cat"
          class="px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
          [ngClass]="selectedCat === cat ? 'bg-[#C5A059] text-[#0A0A0A] font-semibold' : 'bg-[#141414] text-[#737373] hover:text-white'"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Reports List -->
      <div *ngIf="filteredReports.length === 0">
        <app-empty-state
          icon="description"
          title="No reports found"
          description="No reports match the selected category."
        ></app-empty-state>
      </div>

      <div *ngIf="filteredReports.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          *ngFor="let rpt of filteredReports"
          class="bg-[#0D0D0D] border border-white/5 hover:border-[#C5A059]/30 rounded-xl p-5 space-y-4 transition-all group"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono-data font-bold text-white text-[13px] group-hover:text-[#C5A059] transition-colors">
                  {{ rpt.id }}
                </span>
                <span
                  class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono-data"
                  [ngClass]="rpt.riskLevel === 'CRITICAL' ? 'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30' : 'bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30'"
                >
                  {{ rpt.riskLevel }}
                </span>
                <app-status-badge [status]="rpt.status"></app-status-badge>
              </div>
              <h3 class="text-white font-semibold text-[14px] mt-1.5">{{ rpt.title }}</h3>
            </div>
            <span class="text-[11px] font-mono-data text-[#737373] whitespace-nowrap">{{ rpt.date }}</span>
          </div>

          <p class="text-[12px] text-[#A3A3A3] leading-relaxed bg-[#141414] p-3 rounded-lg border border-white/5">
            {{ rpt.summary }}
          </p>

          <div class="flex items-center justify-between text-[11px] text-[#737373]">
            <div class="flex items-center gap-2">
              <span>Author: <strong class="text-white">{{ rpt.generatedBy }}</strong></span>
              <span *ngIf="rpt.isAiGenerated" class="bg-[#C5A059]/15 text-[#C5A059] px-1.5 py-0.2 rounded font-mono-data font-semibold">
                AI DRAFT
              </span>
            </div>
            <span>{{ rpt.findingsCount }} findings logged</span>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-white/5">
            <span class="text-[11px] text-[#737373] font-mono-data">Subject: {{ rpt.entityName }}</span>
            <div class="flex items-center gap-2">
              <button
                (click)="exportReport(rpt)"
                class="px-2.5 py-1 bg-[#141414] hover:bg-[#1C1C1C] text-[#A3A3A3] hover:text-white border border-white/10 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[14px]">download</span>
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
     </ng-container>
    </div>
  `
})
export class InvestigationReportsComponent implements OnInit {
  selectedCat = 'All';

  readonly categories = [
    'All',
    'SAR Report',
    'AML Audit Summary',
    'Account Takeover',
    'Velocity Anomaly'
  ];

  toastMsg = '';

  constructor(
    public analyticsService: AnalyticsService,
    public modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.analyticsService.getReports().subscribe();
  }

  refreshData(): void {
    this.analyticsService.getReports().subscribe();
  }

  get reports(): InvestigationReport[] {
    return this.analyticsService.reports();
  }

  get filteredReports(): InvestigationReport[] {
    if (this.selectedCat === 'All') return this.reports;
    return this.reports.filter(r => r.category === this.selectedCat);
  }

  exportReport(rpt: InvestigationReport): void {
    this.toastMsg = `Exporting ${rpt.id} dossier (FinCEN SAR standard PDF)…`;
    setTimeout(() => {
      this.toastMsg = '';
    }, 3000);
  }
}
