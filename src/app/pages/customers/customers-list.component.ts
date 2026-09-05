import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer.model';
import { RiskTier } from '../../models/types.model';
import { RiskBadgeComponent } from '../../shared/components/risk-badge.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    RiskBadgeComponent,
    StatusBadgeComponent,
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
      <div *ngIf="customerService.loading()" class="flex items-center justify-center py-16">
        <div class="flex items-center gap-3 text-[#C5A059]">
          <div class="w-5 h-5 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
          <span class="text-[13px]">Loading customers...</span>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="customerService.error()" class="bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 rounded-xl p-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[#ffb4ab] text-[18px]">error</span>
          <span class="text-[13px] text-[#ffb4ab]">{{ customerService.error() }}</span>
        </div>
        <button
          (click)="refreshData()"
          class="px-3 py-1.5 bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 text-[#ffb4ab] border border-[#ffb4ab]/30 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap"
        >
          Retry
        </button>
      </div>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight">Customer Intelligence</h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Behavioral profiling, identity verification, and multi-account threat correlation.
          </p>
        </div>
        <button
          (click)="refreshData()"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#C5A059] text-[#A3A3A3] hover:text-[#0A0A0A] border border-white/5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
        >
          <span class="material-symbols-outlined text-[14px]">refresh</span>
          Refresh
        </button>
      </div>

      <ng-container *ngIf="!customerService.loading()">
      <!-- Filters -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div class="flex items-center bg-[#141414] rounded-lg px-3 py-1.5 border border-white/10 focus-within:border-[#C5A059] transition-all flex-1 min-w-[200px]">
          <span class="material-symbols-outlined text-[#737373] text-[16px] mr-2">search</span>
          <input
            type="text"
            [(ngModel)]="search"
            placeholder="Search by customer name, ID, email, or city…"
            class="bg-transparent border-none text-[13px] text-[#D4D4D4] placeholder-[#737373] w-full focus:outline-none"
          />
        </div>

        <select
          [(ngModel)]="riskFilter"
          class="bg-[#141414] border border-white/10 text-[#D4D4D4] text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#C5A059] cursor-pointer"
        >
          <option value="All">All Risk Tiers</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <!-- Table -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl overflow-hidden">
        <div *ngIf="filteredCustomers.length === 0">
          <app-empty-state
            icon="group"
            title="No customers found"
            description="Try adjusting your search criteria."
          ></app-empty-state>
        </div>

        <div *ngIf="filteredCustomers.length > 0" class="overflow-x-auto">
          <table class="w-full text-left text-[13px]">
            <thead>
              <tr class="border-b border-white/5 text-[#737373] text-[10px] uppercase tracking-[0.12em]">
                <th class="pl-4 py-3">Customer Entity</th>
                <th class="py-3 pr-3">Risk Score</th>
                <th class="py-3 pr-3">Status</th>
                <th class="py-3 pr-3">30D Volume</th>
                <th class="py-3 pr-3">Avg Txn</th>
                <th class="py-3 pr-3">KYC</th>
                <th class="py-3 pr-3">Devices</th>
                <th class="py-3 pr-3">City / Residence</th>
                <th class="py-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr
                *ngFor="let cust of filteredCustomers"
                (click)="onSelect(cust)"
                class="hover:bg-[#141414] transition-colors group cursor-pointer"
              >
                <td class="pl-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] text-[10px] font-bold shrink-0">
                      {{ cust.initials || cust.name.slice(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-medium text-white group-hover:text-[#C5A059] transition-colors text-[12px]">
                        {{ cust.name }}
                      </div>
                      <div class="text-[10px] text-[#737373] font-mono-data">{{ cust.id }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3 pr-3">
                  <div class="flex items-center gap-2">
                    <span class="font-mono-data font-bold" [ngClass]="cust.riskScore > 75 ? 'text-[#ffb4ab]' : (cust.riskScore > 50 ? 'text-[#C5A059]' : 'text-[#52b788]')">
                      {{ cust.riskScore }}/100
                    </span>
                    <app-risk-badge [tier]="cust.riskTier"></app-risk-badge>
                  </div>
                </td>
                <td class="py-3 pr-3">
                  <app-status-badge [status]="cust.status"></app-status-badge>
                </td>
                <td class="py-3 pr-3 font-mono-data font-bold text-white">
                  {{ cust.vol30d | inrCurrency:true }}
                </td>
                <td class="py-3 pr-3 font-mono-data text-[#A3A3A3]">
                  {{ cust.avgTxn | inrCurrency:true }}
                </td>
                <td class="py-3 pr-3">
                  <span
                    class="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono-data"
                    [ngClass]="cust.kycStatus === 'Verified' ? 'bg-[#52b788]/15 text-[#52b788] border border-[#52b788]/30' : 'bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30'"
                  >
                    {{ cust.kycStatus }}
                  </span>
                </td>
                <td class="py-3 pr-3 text-[#A3A3A3]">
                  {{ cust.knownDevicesCount }} device{{ cust.knownDevicesCount > 1 ? 's' : '' }}
                </td>
                <td class="py-3 pr-3 text-[#A3A3A3] truncate max-w-[130px]">
                  {{ cust.city }}
                </td>
                <td class="py-3 pr-4 text-right" (click)="$event.stopPropagation()">
                  <button
                    (click)="onSelect(cust)"
                    class="px-2.5 py-1 bg-[#141414] hover:bg-[#C5A059] text-[#A3A3A3] hover:text-[#0A0A0A] border border-white/5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    360 Profile →
                  </button>
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
export class CustomersListComponent implements OnInit {
  search = '';
  riskFilter: RiskTier | 'All' = 'All';

  constructor(
    public customerService: CustomerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.customerService.loadCustomers().subscribe();
  }

  get customers(): Customer[] {
    return this.customerService.getCustomers();
  }

  get filteredCustomers(): Customer[] {
    let list = this.customers;
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      list = list.filter(c =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }
    if (this.riskFilter !== 'All') {
      list = list.filter(c => c.riskTier === this.riskFilter);
    }
    return list;
  }

  onSelect(cust: Customer): void {
    this.customerService.selectCustomer(cust);
    this.router.navigate(['/customers', cust.id]);
  }
}
