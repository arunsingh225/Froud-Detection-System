import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/types.model';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number | string;
  badgeSev?: 'critical' | 'warn' | 'ok';
  dividerBefore?: boolean;
  roles?: UserRole[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside
      class="flex flex-col bg-[#0D0D0D] border-r border-white/5 shrink-0 overflow-hidden h-full transition-all duration-200"
      [style.width.px]="collapsed ? 64 : 240"
    >
      <!-- Logo -->
      <div class="flex items-center gap-3 px-4 py-4 border-b border-white/5 shrink-0 overflow-hidden">
        <div class="w-8 h-8 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-[18px] text-[#C5A059]">shield</span>
        </div>
        <div *ngIf="!collapsed" class="overflow-hidden whitespace-nowrap">
          <div class="font-serif italic text-[15px] text-white leading-none">FraudGuard AI</div>
          <div class="text-[9px] text-[#C5A059] font-mono-data uppercase tracking-[0.15em] mt-0.5">Risk Intelligence</div>
        </div>
      </div>

      <!-- Nav Items -->
      <nav class="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
        <ng-container *ngFor="let item of visibleNavItems">
          <div *ngIf="item.dividerBefore" class="my-2 mx-2 border-t border-white/5"></div>
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-[#C5A059]/10 border-[#C5A059]/25 text-[#C5A059]"
            [routerLinkActiveOptions]="{ exact: false }"
            [title]="collapsed ? item.label : ''"
            class="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border border-transparent text-[#737373] hover:text-white hover:bg-[#141414]"
          >
            <span class="material-symbols-outlined text-[20px] shrink-0 transition-colors group-hover:text-white">
              {{ item.icon }}
            </span>

            <span *ngIf="!collapsed" class="text-[12px] font-medium whitespace-nowrap flex-1 overflow-hidden">
              {{ item.label }}
            </span>

            <span
              *ngIf="!collapsed && item.badge !== undefined"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono-data shrink-0"
              [ngClass]="getBadgeColor(item.badgeSev)"
            >
              {{ item.badge }}
            </span>
          </a>
        </ng-container>
      </nav>

      <!-- User Footer with RBAC Badge -->
      <div class="px-2 py-3 border-t border-white/5 shrink-0">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#141414] border border-white/5">
          <div class="w-6 h-6 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] text-[10px] font-bold shrink-0">
            {{ authService.currentUser()?.initials || 'FG' }}
          </div>
          <div *ngIf="!collapsed" class="overflow-hidden whitespace-nowrap flex-1">
            <div class="text-[11px] font-medium text-white truncate">{{ authService.currentUser()?.name || 'Authorized User' }}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span
                class="text-[8px] font-mono-data uppercase px-1.5 py-0.2 rounded font-bold"
                [ngClass]="getRoleBadgeClass(authService.userRole())"
              >
                {{ authService.userRole() || 'INVESTIGATOR' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  @Input() collapsed: boolean = false;

  readonly navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/transactions', label: 'Transactions', icon: 'receipt_long', badge: 8 },
    { path: '/fraud-alerts', label: 'Fraud Alerts', icon: 'crisis_alert', badge: 4, badgeSev: 'critical' },
    { path: '/investigations', label: 'Investigations', icon: 'find_in_page', badge: 5 },
    { path: '/ai-investigator', label: 'AI Investigator', icon: 'psychology', badge: 'AI', badgeSev: 'ok' },
    { path: '/customers', label: 'Customer Intelligence', icon: 'group', dividerBefore: true },
    { path: '/risk-analytics', label: 'Risk Analytics', icon: 'bar_chart_4_bars' },
    { path: '/investigation-reports', label: 'Reports', icon: 'description' },
    { path: '/audit-logs', label: 'Audit Log', icon: 'history', dividerBefore: true, roles: ['ADMIN', 'COMPLIANCE'] },
    { path: '/settings', label: 'Settings', icon: 'settings', roles: ['ADMIN'] }
  ];

  constructor(public authService: AuthService) {}

  get visibleNavItems(): NavItem[] {
    const role = this.authService.userRole();
    return this.navItems.filter(item => {
      if (!item.roles || item.roles.length === 0) return true;
      return role ? item.roles.includes(role) : false;
    });
  }

  getRoleBadgeClass(role: UserRole | null): string {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-950/80 text-purple-300 border border-purple-500/40';
      case 'COMPLIANCE':
        return 'bg-blue-950/80 text-blue-300 border border-blue-500/40';
      case 'INVESTIGATOR':
      default:
        return 'bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/40';
    }
  }

  getBadgeColor(sev?: 'critical' | 'warn' | 'ok'): string {
    switch (sev) {
      case 'critical':
        return 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30';
      case 'warn':
        return 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30';
      case 'ok':
        return 'bg-[#52b788]/20 text-[#52b788] border border-[#52b788]/30';
      default:
        return 'bg-white/10 text-white/70';
    }
  }
}
