import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';
import { SidebarComponent } from './components/sidebar.component';
import { TopHeaderComponent } from './components/top-header.component';
import { NewInvestigationModalComponent } from './shared/modals/new-investigation-modal.component';
import { SarReportModalComponent } from './shared/modals/sar-report-modal.component';
import { NewTransactionModalComponent } from './shared/modals/new-transaction-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent,
    TopHeaderComponent,
    NewInvestigationModalComponent,
    SarReportModalComponent,
    NewTransactionModalComponent
  ],
  template: `
    <!-- If on Login Screen or unauthenticated -->
    <div *ngIf="showLoginLayout" class="w-full h-full min-h-screen overflow-y-auto overflow-x-hidden">
      <router-outlet></router-outlet>
    </div>

    <!-- If in Authenticated Dashboard Shell -->
    <div *ngIf="!showLoginLayout" class="h-screen flex overflow-hidden bg-[#0A0A0A] select-none">
      <!-- Sidebar -->
      <app-sidebar class="shrink-0" [collapsed]="sidebarCollapsed"></app-sidebar>

      <!-- Main App Body -->
      <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <!-- Top App Bar -->
        <app-top-header
          class="shrink-0"
          [sidebarCollapsed]="sidebarCollapsed"
          (toggleSidebar)="sidebarCollapsed = !sidebarCollapsed"
        ></app-top-header>

        <!-- Dynamic Router Outlet Page: ONLY THIS AREA SCROLLS -->
        <main class="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden relative">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Global Modals -->
      <app-new-investigation-modal></app-new-investigation-modal>
      <app-sar-report-modal></app-sar-report-modal>
      <app-new-transaction-modal></app-new-transaction-modal>
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  isLoginScreen = false;

  private routerSub?: Subscription;

  constructor(
    private router: Router,
    public authService: AuthService,
    private themeService: ThemeService
  ) {}

  get showLoginLayout(): boolean {
    return this.isLoginScreen || !this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    this.checkLoginScreen(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.checkLoginScreen(event.urlAfterRedirects || event.url);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private checkLoginScreen(url: string): void {
    this.isLoginScreen = !url || url === '/' || url.startsWith('/login');
  }
}
