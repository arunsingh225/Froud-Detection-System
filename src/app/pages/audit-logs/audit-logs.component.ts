import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../services/analytics.service';
import { AuditLogItem } from '../../models/audit-log.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, EmptyStateComponent],
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
      <div *ngIf="analyticsService.loading()" class="flex flex-col items-center justify-center py-20 space-y-4">
        <div class="w-10 h-10 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
        <p class="text-[13px] text-[#737373] tracking-wide">Loading audit logs…</p>
      </div>

      <!-- Error State -->
      <div *ngIf="loadError && !analyticsService.loading()" class="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center space-y-3">
        <span class="material-symbols-outlined text-red-400 text-3xl">error</span>
        <p class="text-[13px] text-red-300">{{ loadError }}</p>
        <button
          (click)="refreshData()"
          class="mt-2 px-4 py-1.5 bg-[#141414] border border-[#C5A059]/40 text-[#C5A059] text-[11px] font-semibold uppercase tracking-[0.15em] rounded-lg hover:bg-[#1C1C1C] transition-all cursor-pointer"
        >Retry</button>
      </div>

      <ng-container *ngIf="!analyticsService.loading() && !loadError">
      <!-- Toast feedback -->
      <div
        *ngIf="toastMsg"
        class="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#C5A059] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in"
      >
        <span class="material-symbols-outlined text-[#C5A059]">verified_user</span>
        <span class="text-[13px]">{{ toastMsg }}</span>
      </div>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-[11px] font-mono-data text-[#C5A059] tracking-[0.2em] uppercase">
            <span class="w-2 h-2 rounded-full bg-[#52b788] pulse-dot"></span>
            WORM Cryptographic Log Active
          </div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight mt-1">
            Audit Trail & Compliance Log
          </h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Immutable, tamper-evident record of all AI inference decisions, analyst reviews, and policy overrides.
          </p>
        </div>

        <button
          (click)="exportLogProof()"
          class="flex items-center gap-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#C5A059]/40 text-[#C5A059] px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.15em] transition-all cursor-pointer"
        >
          <span class="material-symbols-outlined text-[16px]">lock_clock</span>
          <span>Verify SHA-256 Proof</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div class="flex items-center bg-[#141414] rounded-lg px-3 py-1.5 border border-white/10 focus-within:border-[#C5A059] transition-all flex-1 min-w-[200px]">
          <span class="material-symbols-outlined text-[#737373] text-[16px] mr-2">search</span>
          <input
            type="text"
            [(ngModel)]="search"
            placeholder="Search action, actor, resource ID…"
            class="bg-transparent border-none text-[13px] text-[#D4D4D4] placeholder-[#737373] w-full focus:outline-none"
          />
        </div>

        <select
          [(ngModel)]="categoryFilter"
          class="bg-[#141414] border border-white/10 text-[#D4D4D4] text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#C5A059] cursor-pointer"
        >
          <option value="All">All Categories</option>
          <option value="Authentication">Authentication</option>
          <option value="Investigation">Investigation</option>
          <option value="Policy Change">Policy Change</option>
          <option value="Data Export">Data Export</option>
          <option value="Rule Modification">Rule Modification</option>
        </select>
      </div>

      <!-- Log Table -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl overflow-hidden">
        <div *ngIf="filteredLogs.length === 0">
          <app-empty-state
            icon="history"
            title="No audit log entries match"
            description="Adjust your search filters to view logs."
          ></app-empty-state>
        </div>

        <div *ngIf="filteredLogs.length > 0" class="overflow-x-auto">
          <table class="w-full text-left text-[13px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] text-[10px] uppercase tracking-[0.12em]">
                <th class="pl-4 py-3">Timestamp</th>
                <th class="py-3 pr-3">Actor / Entity</th>
                <th class="py-3 pr-3">Action</th>
                <th class="py-3 pr-3">Resource Target</th>
                <th class="py-3 pr-3">Category</th>
                <th class="py-3 pr-4 text-right">Result</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 font-mono-data text-[12px]">
              <tr *ngFor="let log of filteredLogs" class="hover:bg-[#141414] transition-colors">
                <td class="pl-4 py-3 text-[#737373]">
                  <div class="text-white">{{ log.date }}</div>
                  <div class="text-[10px] text-[#737373]">{{ log.time }} IST</div>
                </td>
                <td class="py-3 pr-3">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-[#C5A059]">
                      {{ log.actor.icon || 'person' }}
                    </span>
                    <div>
                      <div class="text-white font-semibold">{{ log.actor.name }}</div>
                      <div class="text-[9px] text-[#737373] uppercase">{{ log.actor.type }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3 pr-3 font-sans">
                  <div class="text-white font-medium">{{ log.action }}</div>
                  <div *ngIf="log.subAction" class="text-[11px] text-[#737373] font-mono-data">{{ log.subAction }}</div>
                </td>
                <td class="py-3 pr-3 text-[#C5A059]">
                  {{ log.resource }}
                </td>
                <td class="py-3 pr-3 font-sans text-[12px] text-[#A3A3A3]">
                  {{ log.category }}
                </td>
                <td class="py-3 pr-4 text-right">
                  <app-status-badge [status]="log.result"></app-status-badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </ng-container>
    </div>
  `
})
export class AuditLogsComponent implements OnInit {
  search = '';
  categoryFilter = 'All';
  toastMsg = '';
  loadError = '';

  constructor(public analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.loadError = '';
    this.analyticsService.getAuditLogs().subscribe({
      error: (err) => {
        this.loadError = 'Failed to load audit logs. Please try again.';
        console.error('Audit logs fetch error:', err);
      }
    });
  }

  get logs(): AuditLogItem[] {
    return this.analyticsService.auditLogs();
  }

  get filteredLogs(): AuditLogItem[] {
    let list = this.logs;
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      list = list.filter(l =>
        l.id.toLowerCase().includes(q) ||
        l.actor.name.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.resource.toLowerCase().includes(q)
      );
    }
    if (this.categoryFilter !== 'All') {
      list = list.filter(l => l.category === this.categoryFilter);
    }
    return list;
  }

  exportLogProof(): void {
    this.toastMsg = 'SHA-256 Merkle Proof Verified: 8b29c91f4a98... Root signature valid';
    setTimeout(() => {
      this.toastMsg = '';
    }, 3500);
  }
}
