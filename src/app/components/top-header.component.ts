import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter, Subscription, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { AnalyticsService } from '../services/analytics.service';
import { AppNotification } from '../models/notification.model';
import { SearchResultDto, ApiResponse } from '../models/api-response.model';

@Component({
  selector: 'app-top-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <header class="bg-[#0D0D0D] border-b border-white/5 flex items-center justify-between px-4 py-3 shrink-0 relative z-30">
      <!-- Left: Toggle & Title -->
      <div class="flex items-center gap-3">
        <button
          (click)="toggleSidebar.emit()"
          class="p-1.5 rounded-lg hover:bg-[#1A1A1A] text-[#737373] hover:text-white transition-colors cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <span class="material-symbols-outlined text-[22px]">
            {{ sidebarCollapsed ? 'menu' : 'menu_open' }}
          </span>
        </button>
        <div class="hidden sm:block">
          <h1 class="text-[14px] font-semibold text-white leading-none">
            {{ currentTitle }}
          </h1>
          <span class="text-[11px] text-[#737373] font-mono-data">SYNTHETIC DEMO DATA</span>
        </div>
      </div>

      <!-- Right: Search, Theme, Notifications, User -->
      <div class="flex items-center gap-1.5">
        <!-- Search -->
        <div class="relative" #searchContainer>
          <div *ngIf="searchOpen" class="flex items-center bg-[#141414] rounded-lg border border-[#C5A059] px-3 py-1.5 w-[220px] sm:w-[300px]">
            <button
              (click)="executeSearch()"
              title="Search"
              class="material-symbols-outlined text-[#C5A059] text-[18px] mr-2 hover:text-white cursor-pointer transition-colors"
            >
              search
            </button>
            <input
              #searchInput
              type="text"
              [(ngModel)]="searchQuery"
              (keydown.enter)="executeSearch()"
              (keydown.escape)="closeSearch()"
              placeholder="Search ID, customer, alert…"
              class="bg-transparent border-none text-[13px] text-[#D4D4D4] placeholder-[#737373] w-full focus:outline-none"
            />
            <button *ngIf="searchQuery" (click)="clearSearch()" class="cursor-pointer text-[#737373] hover:text-white ml-1">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <button
            *ngIf="!searchOpen"
            (click)="openSearch()"
            class="p-1.5 rounded-lg hover:bg-[#1A1A1A] text-[#737373] hover:text-white transition-colors cursor-pointer"
            aria-label="Open search"
          >
            <span class="material-symbols-outlined text-[22px]">search</span>
          </button>

          <!-- Search Results Dropdown -->
          <div
            *ngIf="searchOpen && (searchLoading || searchPerformed)"
            class="absolute right-0 top-full mt-2 w-[320px] sm:w-[400px] bg-[#0D0D0D] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in"
          >
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#141414]">
              <span class="text-[11px] font-mono-data text-[#A3A3A3] uppercase tracking-wider">Search Results</span>
              <span *ngIf="!searchLoading" class="text-[10px] font-mono-data text-[#C5A059]">{{ searchResults.length }} matches</span>
            </div>

            <!-- Loading State -->
            <div *ngIf="searchLoading" class="p-6 flex items-center justify-center gap-2 text-[#C5A059] text-xs">
              <div class="w-4 h-4 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
              <span>Searching enterprise records...</span>
            </div>

            <!-- Empty State -->
            <div *ngIf="!searchLoading && searchPerformed && searchResults.length === 0" class="p-6 text-center text-xs text-[#737373]">
              <span class="material-symbols-outlined text-[28px] block mb-1 text-[#737373]">search_off</span>
              <span>No results found for "{{ searchQuery }}"</span>
            </div>

            <!-- Results List -->
            <div *ngIf="!searchLoading && searchResults.length > 0" class="max-h-[320px] overflow-y-auto divide-y divide-white/5">
              <button
                *ngFor="let item of searchResults"
                (click)="navigateToResult(item)"
                class="w-full px-4 py-2.5 hover:bg-[#1A1A1A] transition-colors text-left flex items-center gap-3 cursor-pointer group"
              >
                <div
                  class="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                  [ngClass]="getTypeBadgeClass(item.type)"
                >
                  <span class="material-symbols-outlined text-[14px]">
                    {{ getTypeIcon(item.type) }}
                  </span>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-[12px] font-semibold text-white group-hover:text-[#C5A059] transition-colors truncate">
                      {{ item.title }}
                    </span>
                    <span class="text-[9px] font-mono-data uppercase px-1.5 py-0.5 rounded bg-white/5 text-[#A3A3A3] shrink-0">
                      {{ item.type }}
                    </span>
                  </div>
                  <div class="text-[11px] text-[#737373] truncate">
                    {{ item.subtitle }}
                  </div>
                </div>

                <span *ngIf="item.riskLevel" class="text-[10px] font-mono-data px-1.5 py-0.5 rounded shrink-0"
                  [ngClass]="getRiskBadgeClass(item.riskLevel)"
                >
                  {{ item.riskLevel }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Theme Toggle -->
        <button
          (click)="themeService.toggleTheme()"
          class="p-1.5 rounded-lg hover:bg-[#1A1A1A] text-[#737373] hover:text-white transition-colors cursor-pointer"
          [title]="'Switch to ' + (themeService.isDark() ? 'Light' : 'Dark') + ' Mode'"
        >
          <span class="material-symbols-outlined text-[22px]">
            {{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>

        <!-- Notifications Popover -->
        <div class="relative" #notifContainer>
          <button
            (click)="notifOpen = !notifOpen"
            class="relative p-1.5 rounded-lg hover:bg-[#1A1A1A] text-[#737373] hover:text-white transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <span class="material-symbols-outlined text-[22px]">notifications</span>
            <span
              *ngIf="unreadCount > 0"
              class="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-[#e05353] text-white text-[9px] font-bold rounded-full flex items-center justify-center font-mono-data"
            >
              {{ unreadCount }}
            </span>
          </button>

          <!-- Notifications Dropdown Panel -->
          <div
            *ngIf="notifOpen"
            class="absolute right-0 top-full mt-2 w-[360px] bg-[#0D0D0D] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in"
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div class="flex items-center gap-2">
                <span class="text-[13px] font-semibold text-white">Notifications</span>
                <span
                  *ngIf="unreadCount > 0"
                  class="text-[10px] font-mono-data bg-[#e05353]/20 text-[#ffb4ab] border border-[#e05353]/30 px-1.5 py-0.5 rounded-full font-bold"
                >
                  {{ unreadCount }} new
                </span>
              </div>
              <button
                (click)="analyticsService.markAllNotificationsRead()"
                class="text-[11px] text-[#C5A059] hover:text-white transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            </div>

            <div class="max-h-[360px] overflow-y-auto divide-y divide-white/5">
              <div *ngIf="notifications.length === 0" class="py-10 text-center text-[13px] text-[#737373]">
                <span class="material-symbols-outlined text-[32px] block mb-2">notifications_none</span>
                No notifications
              </div>

              <button
                *ngFor="let notif of notifications"
                (click)="onNotificationClick(notif)"
                class="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#141414] transition-colors text-left cursor-pointer"
                [ngClass]="!notif.isRead ? 'bg-[#141414]/50' : ''"
              >
                <div
                  class="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5"
                  [ngClass]="getSeverityClass(notif.severity)"
                >
                  <span class="material-symbols-outlined text-[16px]">
                    {{ getSeverityIcon(notif.type) }}
                  </span>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <span
                      class="text-[12px] font-semibold leading-tight"
                      [ngClass]="notif.isRead ? 'text-[#A3A3A3]' : 'text-white'"
                    >
                      {{ notif.title }}
                    </span>
                    <span class="text-[10px] text-[#737373] whitespace-nowrap font-mono-data">
                      {{ notif.timeAgo }}
                    </span>
                  </div>
                  <p class="text-[11px] text-[#737373] leading-relaxed mt-0.5 line-clamp-2">
                    {{ notif.description }}
                  </p>
                </div>

                <div *ngIf="!notif.isRead" class="w-2 h-2 rounded-full bg-[#C5A059] shrink-0 mt-2"></div>
              </button>
            </div>

            <div class="px-4 py-2.5 border-t border-white/5 text-center">
              <a
                routerLink="/audit-logs"
                (click)="notifOpen = false"
                class="text-[11px] text-[#C5A059] hover:text-white transition-colors cursor-pointer"
              >
                View full audit log →
              </a>
            </div>
          </div>
        </div>

        <!-- User Profile & Logout -->
        <div class="flex items-center gap-2 pl-1.5">
          <div
            (click)="authService.logout()"
            title="Click to logout"
            class="w-8 h-8 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] text-[11px] font-bold cursor-pointer hover:border-[#e05353] hover:text-[#ffb4ab] transition-colors"
          >
            {{ authService.currentUser()?.initials || 'FG' }}
          </div>
          <div class="hidden md:block text-right">
            <div class="text-[12px] font-semibold text-white leading-none">
              {{ authService.currentUser()?.name || 'User' }}
            </div>
            <div class="text-[9px] text-[#C5A059] font-mono-data uppercase mt-0.5">
              {{ authService.userRole() || 'INVESTIGATOR' }}
            </div>
          </div>
        </div>
      </div>
    </header>
  `
})
export class TopHeaderComponent implements OnInit, OnDestroy {
  @Input() sidebarCollapsed: boolean = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  searchOpen = false;
  searchQuery = '';
  searchResults: SearchResultDto[] = [];
  searchLoading = false;
  searchPerformed = false;
  notifOpen = false;
  currentTitle = 'Dashboard';

  private routerSub?: Subscription;

  private readonly titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/transactions': 'Transactions',
    '/fraud-alerts': 'Fraud Alerts',
    '/investigations': 'Investigation Center',
    '/ai-investigator': 'AI Investigator',
    '/customers': 'Customer Intelligence',
    '/risk-analytics': 'Risk Analytics',
    '/investigation-reports': 'Reports',
    '/audit-logs': 'Audit Log',
    '/settings': 'Settings'
  };

  constructor(
    public themeService: ThemeService,
    public authService: AuthService,
    public analyticsService: AnalyticsService,
    private http: HttpClient,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.updateTitle(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateTitle(event.urlAfterRedirects || event.url);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  get notifications(): AppNotification[] {
    return this.analyticsService.notifications();
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  openSearch(): void {
    this.searchOpen = true;
    setTimeout(() => {
      const el = this.elementRef.nativeElement.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      el?.focus();
    }, 50);
  }

  closeSearch(): void {
    this.searchOpen = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.searchLoading = false;
    this.searchPerformed = false;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.searchLoading = false;
    this.searchPerformed = false;
  }

  executeSearch(): void {
    const q = this.searchQuery?.trim();
    if (!q) return;

    this.searchLoading = true;
    this.searchPerformed = true;

    this.http.get<ApiResponse<SearchResultDto[]>>(`${environment.apiUrl}/search`, {
      params: { q }
    }).pipe(
      catchError(err => {
        console.warn('[TopHeaderComponent] Search query failed:', err);
        return of({ success: false, data: [] as SearchResultDto[] } as ApiResponse<SearchResultDto[]>);
      })
    ).subscribe(res => {
      this.searchLoading = false;
      this.searchResults = (res && res.success && res.data) ? res.data : [];
    });
  }

  navigateToResult(item: SearchResultDto): void {
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
    this.closeSearch();
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'Transaction': return 'receipt_long';
      case 'Customer': return 'person';
      case 'Alert': return 'crisis_alert';
      case 'Investigation': return 'find_in_page';
      default: return 'search';
    }
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'Transaction': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'Customer': return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      case 'Alert': return 'bg-[#e05353]/10 border-[#e05353]/30 text-[#ffb4ab]';
      case 'Investigation': return 'bg-[#C5A059]/10 border-[#C5A059]/30 text-[#C5A059]';
      default: return 'bg-white/5 border-white/10 text-white';
    }
  }

  getRiskBadgeClass(risk?: string): string {
    switch (risk?.toLowerCase()) {
      case 'critical': return 'bg-[#e05353]/20 text-[#ffb4ab]';
      case 'high': return 'bg-amber-500/20 text-amber-300';
      case 'medium': return 'bg-blue-500/20 text-blue-300';
      default: return 'bg-emerald-500/20 text-emerald-300';
    }
  }

  onNotificationClick(notif: AppNotification): void {
    this.analyticsService.markNotificationRead(notif.id);
    this.notifOpen = false;
    if (notif.routePath) {
      this.router.navigateByUrl(notif.routePath);
    }
  }

  getSeverityClass(sev: string): string {
    switch (sev) {
      case 'critical':
        return 'text-[#ffb4ab] bg-[#e05353]/10 border-[#e05353]/25';
      case 'high':
        return 'text-[#C5A059] bg-[#C5A059]/10 border-[#C5A059]/25';
      case 'medium':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
      default:
        return 'text-[#737373] bg-[#1A1A1A] border-white/5';
    }
  }

  getSeverityIcon(type: string): string {
    switch (type) {
      case 'alert': return 'crisis_alert';
      case 'investigation': return 'find_in_page';
      case 'report': return 'description';
      case 'approval': return 'gavel';
      default: return 'settings';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.notifOpen = false;
      this.closeSearch();
    }
  }

  private updateTitle(url: string): void {
    const cleanUrl = url.split('?')[0];
    if (cleanUrl.startsWith('/transactions/')) {
      this.currentTitle = 'Transaction Detail';
    } else if (cleanUrl.startsWith('/investigations/')) {
      this.currentTitle = 'Investigation Detail';
    } else if (cleanUrl.startsWith('/customers/')) {
      this.currentTitle = 'Customer Profile';
    } else {
      this.currentTitle = this.titles[cleanUrl] || 'Dashboard';
    }
  }
}
