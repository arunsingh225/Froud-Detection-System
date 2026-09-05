import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TransactionService } from '../../services/transaction.service';
import { AnalyticsService } from '../../services/analytics.service';
import { ModalService } from '../../services/modal.service';
import { AuthService } from '../../services/auth.service';
import { Transaction } from '../../models/transaction.model';
import { LiveAlertItem, FraudTrendPoint } from '../../models/advanced-analytics.model';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, InrCurrencyPipe],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }
  `],
  template: `
    <div class="w-full min-h-full bg-[#0A0A0A] text-[#D4D4D4] p-4 lg:p-8 pb-12 space-y-6">
      <!-- Loading Overlay -->
      <div *ngIf="analyticsService.loading()" class="flex items-center justify-center py-16">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
          <span class="text-[13px] text-[#A3A3A3] font-mono-data tracking-wide">Connecting to Fraud Intelligence Telemetry…</span>
        </div>
      </div>

      <!-- Operational Health Status Ribbon -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono-data">
        <div class="flex items-center gap-4 flex-wrap">
          <span class="text-[#737373] uppercase tracking-[0.15em]">System Mesh:</span>
          
          <div class="flex items-center gap-1.5 text-[#52b788]">
            <span class="w-2 h-2 rounded-full bg-[#52b788] pulse-dot"></span>
            <span>API (Port 5000)</span>
          </div>

          <div class="flex items-center gap-1.5 text-[#52b788]">
            <span class="w-2 h-2 rounded-full bg-[#52b788] pulse-dot"></span>
            <span>SQL Server 2022</span>
          </div>

          <div class="flex items-center gap-1.5 text-[#52b788]">
            <span class="w-2 h-2 rounded-full bg-[#52b788] pulse-dot"></span>
            <span>FastAPI (Port 8000)</span>
          </div>

          <div class="flex items-center gap-1.5 text-[#C5A059]">
            <span class="w-2 h-2 rounded-full bg-[#C5A059]"></span>
            <span>LightGBM (464 feat)</span>
          </div>

          <div class="flex items-center gap-1.5 text-[#818cf8]">
            <span class="w-2 h-2 rounded-full bg-[#818cf8]"></span>
            <span>Local RAG</span>
          </div>
        </div>

        <div class="flex items-center gap-3 text-[#A3A3A3]">
          <span>SignalR / Live Stream Active</span>
          <button (click)="refreshDashboard()" class="hover:text-white flex items-center gap-1 transition-colors cursor-pointer">
            <span class="material-symbols-outlined text-[14px]">refresh</span>
            <span>Sync</span>
          </button>
        </div>
      </div>

      <!-- Top Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div class="flex items-center gap-2 text-[11px] font-mono-data text-[#C5A059] tracking-[0.2em] uppercase">
            <span class="w-2 h-2 rounded-full bg-[#C5A059] pulse-dot"></span>
            Real-Time Threat Intelligence Active
          </div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight mt-1">
            Fraud Operations Command Center
          </h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Continuous transaction monitoring, neural anomaly inference, and agentic case triage.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            *ngIf="authService.hasAnyRole(['ADMIN', 'INVESTIGATOR'])"
            (click)="modalService.openNewTransactionModal()"
            class="flex items-center gap-1.5 bg-[#141414] hover:bg-[#1C1C1C] border border-[#C5A059]/40 text-[#C5A059] hover:text-white px-3.5 py-2 rounded-lg text-[12px] font-medium tracking-wide transition-colors cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">add_card</span>
            <span>Ingest Transaction</span>
          </button>
          <a
            routerLink="/ai-investigator"
            class="flex items-center gap-2 bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 text-[#D4D4D4] hover:text-white px-3.5 py-2 rounded-lg text-[12px] font-medium tracking-wide transition-colors"
          >
            <span class="material-symbols-outlined text-[18px] text-[#C5A059]">psychology</span>
            <span>Launch AI Copilot</span>
          </a>
          <button
            (click)="modalService.openNewInvestigationModal()"
            class="flex items-center gap-2 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.15em] transition-all shadow-[0_0_16px_rgba(197,160,89,0.25)] hover:shadow-[0_0_24px_rgba(197,160,89,0.4)] active:scale-95 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[17px]">add</span>
            <span>Investigate Transaction</span>
          </button>
        </div>
      </div>

      <!-- 6 Real KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <!-- Metric 1: Total Volume -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-[#C5A059]/40 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em]">Monitored Volume</span>
            <span class="material-symbols-outlined text-[16px] text-[#C5A059]">payments</span>
          </div>
          <div class="text-xl lg:text-2xl font-bold text-white font-mono-data">
            {{ kpis ? formatUsd(kpis.totalTransactionValueUsd) : '--' }}
          </div>
          <div class="text-[11px] text-[#A3A3A3] font-mono-data mt-1">
            {{ kpis ? (kpis.totalTransactionValueInr | inrCurrency:true) : '--' }}
          </div>
        </div>

        <!-- Metric 2: Transactions -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em]">Total Transactions</span>
            <span class="material-symbols-outlined text-[16px] text-[#818cf8]">receipt_long</span>
          </div>
          <div class="text-xl lg:text-2xl font-bold text-white font-mono-data">
            {{ kpis?.totalTransactions ?? '--' }}
          </div>
          <div class="text-[11px] text-[#737373] mt-1">
            Avg: {{ kpis ? (kpis.averageTransactionValueInr | inrCurrency:true) : '--' }}
          </div>
        </div>

        <!-- Metric 3: Flagged & Rate -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-[#e05353]/40 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em]">Flagged Anomalies</span>
            <span class="material-symbols-outlined text-[16px] text-[#e05353]">warning</span>
          </div>
          <div class="text-xl lg:text-2xl font-bold text-[#e05353] font-mono-data">
            {{ kpis?.fraudFlaggedCount ?? '--' }}
          </div>
          <div class="text-[11px] text-[#e05353] font-mono-data mt-1">
            Fraud Rate: {{ kpis?.fraudRatePercentage ?? 0 }}%
          </div>
        </div>

        <!-- Metric 4: Alerts -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-[#fbbf24]/40 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em]">Open Alerts</span>
            <span class="material-symbols-outlined text-[16px] text-[#fbbf24]">notifications_active</span>
          </div>
          <div class="text-xl lg:text-2xl font-bold text-white font-mono-data">
            {{ kpis?.openAlertsCount ?? '--' }}
          </div>
          <div class="text-[11px] text-[#fbbf24] font-mono-data mt-1">
            {{ kpis?.criticalAlertsCount ?? 0 }} Critical Priority
          </div>
        </div>

        <!-- Metric 5: Investigations -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-[#C5A059]/40 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em]">Active Cases</span>
            <span class="material-symbols-outlined text-[16px] text-[#C5A059]">policy</span>
          </div>
          <div class="text-xl lg:text-2xl font-bold text-white font-mono-data">
            {{ kpis?.activeInvestigationsCount ?? '--' }}
          </div>
          <div class="text-[11px] text-[#737373] mt-1">
            Avg Turnaround: {{ kpis?.averageInvestigationHours ?? 2.4 }}h
          </div>
        </div>

        <!-- Metric 6: Prevented Loss -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-[#52b788]/40 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em]">Prevented Loss</span>
            <span class="material-symbols-outlined text-[16px] text-[#52b788]">verified_user</span>
          </div>
          <div class="text-xl lg:text-2xl font-bold text-[#52b788] font-mono-data">
            {{ kpis ? (kpis.preventedFraudLossInr | inrCurrency:true) : '--' }}
          </div>
          <div class="text-[10px] text-[#737373] truncate mt-1" title="Calculated from flagged transactions in review/intervention">
            In review / held
          </div>
        </div>
      </div>

      <!-- Main Analytics Grid: Time-Series Trends + Risk Distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Time-Series Fraud Trend Chart (2 cols) -->
        <div class="lg:col-span-2 bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="font-serif italic text-[18px] text-white tracking-tight">
                Observed Fraud Trends Over Time
              </h3>
              <p class="text-[12px] text-[#A3A3A3]">
                Daily transaction volume vs. flagged rate from SQL Server timestamps.
              </p>
            </div>

            <!-- Period Selector -->
            <div class="flex items-center gap-1 bg-[#141414] p-1 rounded-lg border border-white/5">
              <button
                *ngFor="let p of periods"
                (click)="setPeriod(p)"
                class="px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer"
                [ngClass]="activePeriod === p ? 'bg-[#C5A059] text-[#0A0A0A]' : 'text-[#737373] hover:text-white'"
              >
                {{ p }}
              </button>
            </div>
          </div>

          <!-- SVG Trend Visualization -->
          <div class="h-64 w-full relative flex items-end pt-6 pb-2">
            <svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 600 200">
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#C5A059" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#C5A059" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Grid horizontal lines -->
              <line x1="0" y1="40" x2="600" y2="40" stroke="#262626" stroke-dasharray="4 4" stroke-width="0.5" />
              <line x1="0" y1="100" x2="600" y2="100" stroke="#262626" stroke-dasharray="4 4" stroke-width="0.5" />
              <line x1="0" y1="160" x2="600" y2="160" stroke="#262626" stroke-dasharray="4 4" stroke-width="0.5" />

              <!-- Polyline Data Points -->
              <path [attr.d]="svgAreaPath" fill="url(#trendGrad)" />
              <path [attr.d]="svgLinePath" fill="none" stroke="#C5A059" stroke-width="2.5" stroke-linecap="round" />

              <!-- Data Point Circles -->
              <g *ngFor="let pt of trendPoints; let idx = index">
                <circle
                  [attr.cx]="getX(idx, trendPoints.length)"
                  [attr.cy]="getY(pt.transactions)"
                  r="3.5"
                  fill="#0A0A0A"
                  stroke="#C5A059"
                  stroke-width="2"
                />
              </g>
            </svg>
          </div>

          <!-- X-Axis Labels -->
          <div class="flex justify-between text-[10px] font-mono-data text-[#737373] px-2 border-t border-white/5 pt-2">
            <span *ngFor="let pt of trendPoints">{{ pt.date }}</span>
          </div>
        </div>

        <!-- Risk Distribution Breakdown (1 col) -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-serif italic text-[18px] text-white tracking-tight">
                Risk Tier Distribution
              </h3>
              <span class="text-[10px] font-mono-data text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded border border-[#C5A059]/20">
                Total: {{ riskDist?.total ?? 0 }}
              </span>
            </div>

            <div class="space-y-4">
              <!-- Critical -->
              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="flex items-center gap-1.5 text-[#e05353] font-semibold">
                    <span class="w-2 h-2 rounded-full bg-[#e05353]"></span> Critical Risk
                  </span>
                  <span class="font-mono-data text-white font-bold">{{ riskDist?.critical ?? 0 }}</span>
                </div>
                <div class="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#e05353] rounded-full" [style.width.%]="getPercent(riskDist?.critical, riskDist?.total)"></div>
                </div>
              </div>

              <!-- High -->
              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="flex items-center gap-1.5 text-[#fbbf24] font-semibold">
                    <span class="w-2 h-2 rounded-full bg-[#fbbf24]"></span> High Risk
                  </span>
                  <span class="font-mono-data text-white font-bold">{{ riskDist?.high ?? 0 }}</span>
                </div>
                <div class="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#fbbf24] rounded-full" [style.width.%]="getPercent(riskDist?.high, riskDist?.total)"></div>
                </div>
              </div>

              <!-- Medium -->
              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="flex items-center gap-1.5 text-[#C5A059] font-semibold">
                    <span class="w-2 h-2 rounded-full bg-[#C5A059]"></span> Medium Risk
                  </span>
                  <span class="font-mono-data text-white font-bold">{{ riskDist?.medium ?? 0 }}</span>
                </div>
                <div class="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#C5A059] rounded-full" [style.width.%]="getPercent(riskDist?.medium, riskDist?.total)"></div>
                </div>
              </div>

              <!-- Low -->
              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="flex items-center gap-1.5 text-[#52b788] font-semibold">
                    <span class="w-2 h-2 rounded-full bg-[#52b788]"></span> Low Risk (Clear)
                  </span>
                  <span class="font-mono-data text-white font-bold">{{ riskDist?.low ?? 0 }}</span>
                </div>
                <div class="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#52b788] rounded-full" [style.width.%]="getPercent(riskDist?.low, riskDist?.total)"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Navigation to Risk Analytics -->
          <a
            routerLink="/risk-analytics"
            class="w-full mt-6 text-center text-[11px] uppercase tracking-[0.15em] font-semibold text-[#C5A059] hover:text-white py-2 rounded bg-[#141414] hover:bg-[#1F1F1F] transition-colors border border-white/5 block"
          >
            Explore Deep Risk Telemetry →
          </a>
        </div>
      </div>

      <!-- Live Alerts Queue + Top Risk Merchants Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Live Fraud Alerts Queue (2 cols) -->
        <div class="lg:col-span-2 bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="font-serif italic text-[18px] text-white tracking-tight">
                Live Fraud Alerts Queue
              </h3>
              <span class="w-2 h-2 rounded-full bg-[#e05353] pulse-dot"></span>
            </div>
            <span class="text-[11px] text-[#737373] font-mono-data">Auto-syncing every 10s</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-[12px]">
              <thead>
                <tr class="border-b border-white/5 text-[#737373] font-mono-data text-[10px] uppercase tracking-[0.15em]">
                  <th class="pb-2.5">Alert / Txn</th>
                  <th class="pb-2.5">Subject</th>
                  <th class="pb-2.5">Amount</th>
                  <th class="pb-2.5">Severity / Prob</th>
                  <th class="pb-2.5">Trigger Reason</th>
                  <th class="pb-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr *ngFor="let alert of liveAlerts" class="hover:bg-[#141414] transition-colors group">
                  <td class="py-2.5 pr-2">
                    <div class="font-mono-data font-bold text-white group-hover:text-[#C5A059] transition-colors">
                      {{ alert.alertCode }}
                    </div>
                    <div class="text-[10px] text-[#737373] font-mono-data">
                      {{ alert.transactionCode }}
                    </div>
                  </td>

                  <td class="py-2.5">
                    <div class="text-white font-medium">{{ alert.customerName }}</div>
                  </td>

                  <td class="py-2.5 font-mono-data text-white">
                    {{ alert.amountInr | inrCurrency:true }}
                  </td>

                  <td class="py-2.5">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono-data"
                        [ngClass]="alert.severity === 'Critical' ? 'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30' : 'bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30'"
                      >
                        {{ alert.severity }}
                      </span>
                      <span class="font-mono-data text-[11px] text-white">
                        {{ alert.fraudProbability }}%
                      </span>
                    </div>
                  </td>

                  <td class="py-2.5 text-[#A3A3A3] text-[11px] max-w-[200px] truncate" [title]="alert.reason">
                    {{ alert.reason }}
                  </td>

                  <td class="py-2.5 text-right">
                    <a
                      routerLink="/ai-investigator"
                      class="bg-[#C5A059]/10 hover:bg-[#C5A059] text-[#C5A059] hover:text-[#0A0A0A] px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all border border-[#C5A059]/30 inline-flex items-center gap-1"
                    >
                      <span class="material-symbols-outlined text-[13px]">psychology</span>
                      <span>Triage</span>
                    </a>
                  </td>
                </tr>

                <tr *ngIf="liveAlerts.length === 0">
                  <td colspan="6" class="py-8 text-center text-[#737373]">
                    No active fraud alerts in queue.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Risk Merchants (1 col) -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-serif italic text-[18px] text-white tracking-tight">
                Top Risk Merchants
              </h3>
              <span class="text-[11px] text-[#737373] font-mono-data">By Fraud Rate</span>
            </div>

            <div class="space-y-3">
              <div
                *ngFor="let m of topMerchants"
                class="p-2.5 rounded-lg bg-[#141414] border border-white/5 text-[12px] flex items-center justify-between"
              >
                <div>
                  <div class="font-semibold text-white">{{ m.merchantName }}</div>
                  <div class="text-[10px] text-[#737373] font-mono-data">MCC {{ m.mcc }} • {{ m.category }}</div>
                </div>

                <div class="text-right">
                  <div class="font-mono-data font-bold text-[#e05353]">{{ (m.fraudRate * 100).toFixed(1) }}%</div>
                  <div class="text-[10px] text-[#737373]">{{ m.transactionCount }} txns</div>
                </div>
              </div>
            </div>
          </div>

          <a
            routerLink="/risk-analytics"
            class="w-full mt-4 text-center text-[11px] uppercase tracking-[0.15em] font-semibold text-[#C5A059] hover:text-white py-2 rounded bg-[#141414] hover:bg-[#1F1F1F] transition-colors border border-white/5 block"
          >
            View All Merchants →
          </a>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  periods = ['24h', '7d', '30d', '90d'];
  activePeriod = '7d';

  constructor(
    public transactionService: TransactionService,
    public modalService: ModalService,
    public analyticsService: AnalyticsService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.analyticsService.loadDashboardData();
    this.transactionService.loadTransactions().subscribe();
  }

  refreshDashboard(): void {
    this.analyticsService.loadDashboardData();
  }

  setPeriod(period: string): void {
    this.activePeriod = period;
    this.analyticsService.getFraudTrends(period).subscribe();
  }

  get kpis() {
    return this.analyticsService.advancedKpis();
  }

  get trendPoints(): FraudTrendPoint[] {
    return this.analyticsService.fraudTrends();
  }

  get riskDist() {
    return this.analyticsService.riskDistribution();
  }

  get liveAlerts(): LiveAlertItem[] {
    return this.analyticsService.liveAlerts();
  }

  get topMerchants() {
    return this.analyticsService.merchantRisk().slice(0, 5);
  }

  formatUsd(val: number): string {
    if (!val) return '$0.00';
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
    return '$' + val.toFixed(2);
  }

  getPercent(val?: number, total?: number): number {
    if (!val || !total || total === 0) return 0;
    return Math.round((val / total) * 100);
  }

  // SVG Chart helpers
  getX(index: number, total: number): number {
    if (total <= 1) return 300;
    return Math.round((index / (total - 1)) * 560 + 20);
  }

  getY(val: number): number {
    const max = Math.max(...this.trendPoints.map(p => p.transactions), 10);
    return Math.round(180 - (val / max) * 140);
  }

  get svgLinePath(): string {
    const pts = this.trendPoints;
    if (pts.length === 0) return 'M 0 180 L 600 180';
    return pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${this.getX(i, pts.length)} ${this.getY(pt.transactions)}`).join(' ');
  }

  get svgAreaPath(): string {
    const pts = this.trendPoints;
    if (pts.length === 0) return '';
    const line = this.svgLinePath;
    const lastX = this.getX(pts.length - 1, pts.length);
    const firstX = this.getX(0, pts.length);
    return `${line} L ${lastX} 190 L ${firstX} 190 Z`;
  }
}
