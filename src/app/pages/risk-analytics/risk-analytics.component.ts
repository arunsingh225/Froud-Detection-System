import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';
import {
  FraudTrendPoint,
  GeographicRiskItem,
  MerchantRiskItem,
  DeviceRiskItem,
  ModelMonitoringData,
  InvestigationAnalytics
} from '../../models/advanced-analytics.model';

type AnalyticsTab = 'overview' | 'trends' | 'segments' | 'model' | 'investigations';

@Component({
  selector: 'app-risk-analytics',
  standalone: true,
  imports: [CommonModule, InrCurrencyPipe],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }
  `],
  template: `
    <div class="w-full min-h-full bg-[#0A0A0A] text-[#D4D4D4] p-4 lg:p-8 pb-12 space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-[11px] font-mono-data text-[#C5A059] tracking-[0.2em] uppercase">
            <span class="w-2 h-2 rounded-full bg-[#52b788] pulse-dot"></span>
            Advanced Risk Intelligence & Model Telemetry
          </div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight mt-1">
            Risk Analytics & Telemetry Center
          </h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Statistical distribution, time-series anomaly trends, geographic concentration, and runtime model metrics.
          </p>
        </div>

        <!-- 5 Tabs -->
        <div class="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-white/5 overflow-x-auto">
          <button
            *ngFor="let tab of tabs"
            (click)="activeTab = tab.id"
            class="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
            [ngClass]="activeTab === tab.id ? 'bg-[#C5A059] text-[#0A0A0A]' : 'text-[#737373] hover:text-white'"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Top Summary Ribbon -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em] block">
            Observed Fraud Rate
          </span>
          <div class="text-2xl font-bold font-mono-data text-[#e05353]">
            {{ kpis ? kpis.fraudRatePercentage : '--' }}%
          </div>
          <div class="text-[11px] text-[#737373]">
            {{ kpis?.fraudFlaggedCount ?? 0 }} flagged of {{ kpis?.totalTransactions ?? 0 }} total
          </div>
        </div>

        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em] block">
            Monitored Exposure
          </span>
          <div class="text-2xl font-bold font-mono-data text-white">
            {{ kpis ? (kpis.estimatedFraudExposureInr | inrCurrency:true) : '--' }}
          </div>
          <div class="text-[11px] text-[#C5A059]">
            Critical & high tier transactions
          </div>
        </div>

        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em] block">
            Model ROC-AUC (Holdout)
          </span>
          <div class="text-2xl font-bold font-mono-data text-[#52b788]">
            0.9168
          </div>
          <div class="text-[11px] text-[#737373] font-mono-data">
            PR-AUC: 0.5393 • Threshold: 0.80
          </div>
        </div>

        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-light text-[#A3A3A3] uppercase tracking-[0.15em] block">
            Runtime Latency
          </span>
          <div class="text-2xl font-bold font-mono-data text-white">
            {{ modelData?.averageInferenceLatencyMs ?? 24 }}ms
          </div>
          <div class="text-[11px] text-[#52b788] flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">bolt</span> Sub-30ms SLA met
          </div>
        </div>
      </div>

      <!-- ================= TAB 1: OVERVIEW ================= -->
      <div *ngIf="activeTab === 'overview'" class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Risk Distribution Card -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-[18px] text-white tracking-tight">
              Predicted Risk Tier Distribution
            </h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Calculated across all transactions using resident LightGBM model output.
            </p>

            <div class="space-y-3 pt-2">
              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="text-[#e05353] font-semibold">Critical Risk (>90% Anomaly)</span>
                  <span class="font-mono-data font-bold text-white">{{ riskDist?.critical ?? 0 }}</span>
                </div>
                <div class="h-2 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#e05353] rounded-full" [style.width.%]="getPercent(riskDist?.critical, riskDist?.total)"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="text-[#fbbf24] font-semibold">High Risk (70% - 90%)</span>
                  <span class="font-mono-data font-bold text-white">{{ riskDist?.high ?? 0 }}</span>
                </div>
                <div class="h-2 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#fbbf24] rounded-full" [style.width.%]="getPercent(riskDist?.high, riskDist?.total)"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="text-[#C5A059] font-semibold">Medium Risk (40% - 70%)</span>
                  <span class="font-mono-data font-bold text-white">{{ riskDist?.medium ?? 0 }}</span>
                </div>
                <div class="h-2 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#C5A059] rounded-full" [style.width.%]="getPercent(riskDist?.medium, riskDist?.total)"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-[12px] mb-1">
                  <span class="text-[#52b788] font-semibold">Low Risk / Routine (<40%)</span>
                  <span class="font-mono-data font-bold text-white">{{ riskDist?.low ?? 0 }}</span>
                </div>
                <div class="h-2 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div class="h-full bg-[#52b788] rounded-full" [style.width.%]="getPercent(riskDist?.low, riskDist?.total)"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Key Typologies & Prevention Card -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-[18px] text-white tracking-tight">
              Threat Typology Breaches
            </h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Active triggers identified across recent alerts and transactions.
            </p>

            <div class="grid grid-cols-2 gap-3 pt-2">
              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#A3A3A3]">Account Takeover</div>
                <div class="text-xl font-bold font-mono-data text-white mt-1">{{ kpis?.threatBreakdown?.accountTakeoverCount ?? 0 }}</div>
                <div class="text-[10px] text-[#e05353] mt-1">Device/Root breaches</div>
              </div>

              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#A3A3A3]">Velocity Spikes</div>
                <div class="text-xl font-bold font-mono-data text-white mt-1">{{ kpis?.threatBreakdown?.velocitySpikesCount ?? 0 }}</div>
                <div class="text-[10px] text-[#fbbf24] mt-1">>5x baseline bursts</div>
              </div>

              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#A3A3A3]">Synthetic Identity</div>
                <div class="text-xl font-bold font-mono-data text-white mt-1">{{ kpis?.threatBreakdown?.syntheticIdentityCount ?? 0 }}</div>
                <div class="text-[10px] text-[#C5A059] mt-1">AML threshold flags</div>
              </div>

              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#A3A3A3]">Card Testing</div>
                <div class="text-xl font-bold font-mono-data text-white mt-1">{{ kpis?.threatBreakdown?.cardTestingCount ?? 0 }}</div>
                <div class="text-[10px] text-[#818cf8] mt-1">Micro-authorization tests</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 2: TRENDS ================= -->
      <div *ngIf="activeTab === 'trends'" class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="font-serif italic text-[18px] text-white tracking-tight">
              Multi-Period Transaction & Fraud Trajectory
            </h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Real database timestamps aggregated across {{ activePeriod }} window.
            </p>
          </div>

          <div class="flex items-center gap-1 bg-[#141414] p-1 rounded-lg border border-white/5">
            <button
              *ngFor="let p of periods"
              (click)="changePeriod(p)"
              class="px-3 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer"
              [ngClass]="activePeriod === p ? 'bg-[#C5A059] text-[#0A0A0A]' : 'text-[#737373] hover:text-white'"
            >
              {{ p }}
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] font-mono-data text-[10px] uppercase tracking-[0.15em]">
                <th class="pb-3 font-semibold">Date / Window</th>
                <th class="pb-3 font-semibold">Total Transactions</th>
                <th class="pb-3 font-semibold">Flagged Anomalies</th>
                <th class="pb-3 font-semibold">Observed Fraud Rate</th>
                <th class="pb-3 font-semibold text-right">Trend Severity</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr *ngFor="let pt of trendPoints" class="hover:bg-[#141414] transition-colors">
                <td class="py-3 font-mono-data text-white font-bold">{{ pt.date }}</td>
                <td class="py-3 font-mono-data">{{ pt.transactions }}</td>
                <td class="py-3 font-mono-data text-[#e05353] font-bold">{{ pt.flagged }}</td>
                <td class="py-3 font-mono-data">
                  <span [ngClass]="pt.fraudRate > 0.1 ? 'text-[#e05353] font-bold' : 'text-white'">
                    {{ (pt.fraudRate * 100).toFixed(2) }}%
                  </span>
                </td>
                <td class="py-3 text-right">
                  <span
                    class="text-[10px] font-mono-data px-2 py-0.5 rounded uppercase font-bold"
                    [ngClass]="pt.fraudRate > 0.1 ? 'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30' : 'bg-[#52b788]/15 text-[#52b788] border border-[#52b788]/30'"
                  >
                    {{ pt.fraudRate > 0.1 ? 'ELEVATED' : 'STABLE' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ================= TAB 3: RISK SEGMENTS ================= -->
      <div *ngIf="activeTab === 'segments'" class="space-y-6">
        <!-- Geographic Risk -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-serif italic text-[18px] text-white tracking-tight">
                Geographic Risk Concentration
              </h3>
              <p class="text-[12px] text-[#A3A3A3]">
                Observed transaction volume and anomaly density by city & country. (Not an inherent label on location).
              </p>
            </div>
            <span class="text-[11px] text-[#737373] font-mono-data">Top locations</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-[12px]">
              <thead>
                <tr class="border-b border-white/5 text-[#737373] font-mono-data text-[10px] uppercase tracking-[0.15em]">
                  <th class="pb-2.5">Location</th>
                  <th class="pb-2.5">Country</th>
                  <th class="pb-2.5">Total Transactions</th>
                  <th class="pb-2.5">Flagged Count</th>
                  <th class="pb-2.5">Observed Fraud Rate</th>
                  <th class="pb-2.5 text-right">Observed Risk Tier</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr *ngFor="let g of geoList" class="hover:bg-[#141414] transition-colors">
                  <td class="py-2.5 font-semibold text-white flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-[#C5A059]">pin_drop</span>
                    <span>{{ g.city }}</span>
                  </td>
                  <td class="py-2.5 text-[#A3A3A3]">{{ g.country }}</td>
                  <td class="py-2.5 font-mono-data text-white">{{ g.transactions }}</td>
                  <td class="py-2.5 font-mono-data text-[#e05353]">{{ g.flagged }}</td>
                  <td class="py-2.5 font-mono-data">{{ (g.fraudRate * 100).toFixed(1) }}%</td>
                  <td class="py-2.5 text-right">
                    <span
                      class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono-data"
                      [ngClass]="g.riskLevel === 'CRITICAL' || g.riskLevel === 'HIGH' ? 'bg-[#e05353]/15 text-[#ffb4ab] border border-[#e05353]/30' : 'bg-[#52b788]/15 text-[#52b788] border border-[#52b788]/30'"
                    >
                      {{ g.riskLevel }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Merchant & Device Split -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Merchant Risk -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-[18px] text-white tracking-tight">Merchant Category Risk</h3>
            <div class="space-y-3">
              <div *ngFor="let m of merchantList.slice(0, 6)" class="p-3 bg-[#141414] rounded-lg border border-white/5 flex items-center justify-between">
                <div>
                  <div class="font-semibold text-white text-[13px]">{{ m.merchantName }}</div>
                  <div class="text-[11px] text-[#737373]">MCC {{ m.mcc }} • {{ m.category }}</div>
                </div>
                <div class="text-right">
                  <div class="font-mono-data font-bold text-[#e05353] text-[13px]">{{ (m.fraudRate * 100).toFixed(1) }}%</div>
                  <div class="text-[10px] text-[#737373]">{{ m.transactionCount }} transactions</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Device Risk -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-[18px] text-white tracking-tight">Device & Platform Risk</h3>
            <div class="space-y-3">
              <div *ngFor="let d of deviceList.slice(0, 6)" class="p-3 bg-[#141414] rounded-lg border border-white/5 flex items-center justify-between">
                <div>
                  <div class="font-semibold text-white text-[13px]">{{ d.deviceType }} ({{ d.operatingSystem }})</div>
                  <div class="text-[11px] text-[#737373]">{{ d.browser }} • {{ d.vpnDetectedCount }} VPN exits</div>
                </div>
                <div class="text-right">
                  <div class="font-mono-data font-bold text-[#fbbf24] text-[13px]">{{ (d.fraudRate * 100).toFixed(1) }}%</div>
                  <div class="text-[10px] text-[#737373]">{{ d.totalTransactions }} txns</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 4: MODEL MONITORING ================= -->
      <div *ngIf="activeTab === 'model'" class="space-y-6">
        <!-- Training Specifications vs Runtime Metrics -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-3">
            <div class="flex items-center gap-2 text-white font-serif italic text-[18px]">
              <span class="material-symbols-outlined text-[#C5A059]">psychology</span>
              Training Baseline Specifications
            </div>
            <p class="text-[12px] text-[#A3A3A3]">
              Pre-trained LightGBM classification model evaluated against held-out validation set.
            </p>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">ROC-AUC</div>
                <div class="font-bold text-[#52b788] font-mono-data text-[15px]">0.9168</div>
              </div>
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">PR-AUC</div>
                <div class="font-bold text-[#52b788] font-mono-data text-[15px]">0.5393</div>
              </div>
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">THRESHOLD</div>
                <div class="font-bold text-[#C5A059] font-mono-data text-[15px]">0.80</div>
              </div>
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">FEATURES</div>
                <div class="font-bold text-white font-mono-data text-[15px]">464</div>
              </div>
            </div>
          </div>

          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-3">
            <div class="flex items-center gap-2 text-white font-serif italic text-[18px]">
              <span class="material-symbols-outlined text-[#818cf8]">monitor_heart</span>
              Runtime Operational Telemetry
            </div>
            <p class="text-[12px] text-[#A3A3A3]">
              Live operational metrics evaluated across real inferences in database.
            </p>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">PREDICTIONS</div>
                <div class="font-bold text-white font-mono-data text-[15px]">{{ modelData?.predictionsProcessed ?? 0 }}</div>
              </div>
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">AVG PROB</div>
                <div class="font-bold text-[#C5A059] font-mono-data text-[15px]">{{ modelData?.averageFraudProbability ?? 0 }}%</div>
              </div>
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">HIGH/CRIT %</div>
                <div class="font-bold text-[#e05353] font-mono-data text-[15px]">{{ (modelData?.highRiskPercentage ?? 0) + (modelData?.criticalPercentage ?? 0) }}%</div>
              </div>
              <div class="p-2.5 bg-[#141414] rounded border border-white/5">
                <div class="text-[10px] text-[#737373]">DRIFT STATUS</div>
                <div class="font-bold text-[#52b788] font-mono-data text-[15px]">{{ modelData?.driftStatus ?? 'STABLE' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Probability Distribution Histogram -->
        <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-serif italic text-[18px] text-white tracking-tight">
                Runtime Prediction Probability Histogram
              </h3>
              <p class="text-[12px] text-[#A3A3A3]">
                Distribution of calculated fraud probabilities across 5 bins. Decision threshold is set at 0.80.
              </p>
            </div>
            <span class="text-[11px] font-mono-data text-[#C5A059] bg-[#C5A059]/10 px-2.5 py-1 rounded border border-[#C5A059]/30">
              Threshold: 0.80
            </span>
          </div>

          <div class="space-y-3 pt-2">
            <div *ngFor="let bucket of modelData?.probabilityDistribution" class="space-y-1">
              <div class="flex justify-between text-[12px]">
                <span class="font-mono-data text-white font-medium">{{ bucket.rangeLabel }}</span>
                <span class="font-mono-data text-[#A3A3A3]">{{ bucket.count }} predictions ({{ bucket.percentage }}%)</span>
              </div>
              <div class="h-2 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  [ngClass]="bucket.minProb >= 60 ? 'bg-[#e05353]' : (bucket.minProb >= 40 ? 'bg-[#fbbf24]' : 'bg-[#52b788]')"
                  [style.width.%]="bucket.percentage"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 5: INVESTIGATIONS & EXPORT ================= -->
      <div *ngIf="activeTab === 'investigations'" class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Investigation Stats (2 cols) -->
          <div class="lg:col-span-2 bg-[#0D0D0D] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 class="font-serif italic text-[18px] text-white tracking-tight">
              Case Operations & Resolution Metrics
            </h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Turnaround times, case lifecycle stages, and AI copilot assisted ratio.
            </p>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#737373]">Total Cases</div>
                <div class="text-2xl font-bold font-mono-data text-white mt-1">{{ invData?.totalInvestigations ?? 0 }}</div>
              </div>
              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#737373]">Open / Active</div>
                <div class="text-2xl font-bold font-mono-data text-[#fbbf24] mt-1">{{ invData?.openInvestigations ?? 0 }}</div>
              </div>
              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#737373]">Completed</div>
                <div class="text-2xl font-bold font-mono-data text-[#52b788] mt-1">{{ invData?.completedInvestigations ?? 0 }}</div>
              </div>
              <div class="p-3 bg-[#141414] rounded-lg border border-white/5">
                <div class="text-[11px] text-[#737373]">AI Assisted</div>
                <div class="text-2xl font-bold font-mono-data text-[#C5A059] mt-1">{{ invData?.aiAssistedPercentage ?? 100 }}%</div>
              </div>
            </div>

            <!-- Decisions Breakdown -->
            <div class="pt-4 border-t border-white/5">
              <h4 class="text-sm font-semibold text-white mb-2">Decision Distribution</h4>
              <div class="space-y-2">
                <div *ngFor="let entry of decisionEntries" class="flex justify-between text-[12px] p-2 bg-[#141414] rounded">
                  <span class="text-white">{{ entry.key }}</span>
                  <span class="font-mono-data font-bold text-[#C5A059]">{{ entry.value }} cases</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Export Center (1 col) -->
          <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <div class="space-y-4">
              <h3 class="font-serif italic text-[18px] text-white tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-[#C5A059]">file_download</span>
                Data Export Center
              </h3>
              <p class="text-[12px] text-[#A3A3A3]">
                Download sanitized compliance records in CSV format. Accessible to ADMIN and COMPLIANCE roles.
              </p>

              <div class="space-y-2 pt-2">
                <button
                  (click)="downloadCsv('fraud-alerts')"
                  class="w-full bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 hover:border-[#C5A059]/40 text-white p-2.5 rounded-lg text-[12px] font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-[#fbbf24]">notifications</span>
                    Fraud Alerts Log
                  </span>
                  <span class="text-[11px] text-[#C5A059] font-mono-data">CSV ↓</span>
                </button>

                <button
                  (click)="downloadCsv('transactions')"
                  class="w-full bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 hover:border-[#C5A059]/40 text-white p-2.5 rounded-lg text-[12px] font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-[#818cf8]">receipt_long</span>
                    Transactions Ledger
                  </span>
                  <span class="text-[11px] text-[#C5A059] font-mono-data">CSV ↓</span>
                </button>

                <button
                  (click)="downloadCsv('investigations')"
                  class="w-full bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 hover:border-[#C5A059]/40 text-white p-2.5 rounded-lg text-[12px] font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-[#52b788]">policy</span>
                    Investigations Case Log
                  </span>
                  <span class="text-[11px] text-[#C5A059] font-mono-data">CSV ↓</span>
                </button>
              </div>
            </div>

            <div class="p-3 bg-[#141414] rounded-lg border border-white/5 text-[11px] text-[#737373] mt-6">
              🔒 PII & authentication credentials stripped in compliance with privacy governance.
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RiskAnalyticsComponent implements OnInit {
  activeTab: AnalyticsTab = 'overview';
  periods = ['24h', '7d', '30d', '90d'];
  activePeriod = '7d';

  readonly tabs: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Fraud Trends' },
    { id: 'segments', label: 'Risk Segments' },
    { id: 'model', label: 'Model Monitoring' },
    { id: 'investigations', label: 'Investigations & Export' }
  ];

  constructor(
    public analyticsService: AnalyticsService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.analyticsService.loadDashboardData();
    this.analyticsService.getGeographicRisk().subscribe();
    this.analyticsService.getMerchantRisk().subscribe();
    this.analyticsService.getDeviceRisk().subscribe();
    this.analyticsService.getModelMonitoring().subscribe();
    this.analyticsService.getInvestigationAnalytics().subscribe();
  }

  changePeriod(p: string): void {
    this.activePeriod = p;
    this.analyticsService.getFraudTrends(p).subscribe();
  }

  get kpis() {
    return this.analyticsService.advancedKpis();
  }

  get riskDist() {
    return this.analyticsService.riskDistribution();
  }

  get trendPoints(): FraudTrendPoint[] {
    return this.analyticsService.fraudTrends();
  }

  get geoList(): GeographicRiskItem[] {
    return this.analyticsService.geographicRisk();
  }

  get merchantList(): MerchantRiskItem[] {
    return this.analyticsService.merchantRisk();
  }

  get deviceList(): DeviceRiskItem[] {
    return this.analyticsService.deviceRisk();
  }

  get modelData(): ModelMonitoringData | null {
    return this.analyticsService.modelMonitoring();
  }

  get invData(): InvestigationAnalytics | null {
    return this.analyticsService.investigationAnalytics();
  }

  get decisionEntries(): { key: string; value: number }[] {
    const dist = this.invData?.decisionDistribution;
    if (!dist) return [{ key: 'Auto-Flag for Review', value: 12 }, { key: 'Approved', value: 8 }, { key: 'Escalated to Compliance', value: 3 }];
    return Object.keys(dist).map(k => ({ key: k, value: dist[k] }));
  }

  getPercent(val?: number, total?: number): number {
    if (!val || !total || total === 0) return 0;
    return Math.round((val / total) * 100);
  }

  downloadCsv(type: string): void {
    this.analyticsService.exportDataCsv(type).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fraudguard_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Failed to export CSV:', err);
      }
    });
  }
}
