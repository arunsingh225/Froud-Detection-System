import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { AdvancedDashboardKpis } from '../models/advanced-analytics.model';

describe('SidebarComponent: live badges', () => {
  const kpis = signal<AdvancedDashboardKpis | null>(null);

  const badges = (): Record<string, string | null> => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    return Object.fromEntries(c.navItems.map(i => [i.label, c.badgeFor(i)]));
  };

  const withKpis = (over: Partial<AdvancedDashboardKpis>) =>
    kpis.set({ totalTransactions: 0, openAlertsCount: 0, activeInvestigationsCount: 0, ...over } as AdvancedDashboardKpis);

  beforeEach(() => {
    kpis.set(null);
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: { advancedKpis: kpis } },
        { provide: AuthService, useValue: { userRole: () => 'ADMIN', currentUser: () => ({ name: 'Test User', initials: 'TU' }) } }
      ]
    });
  });

  it('shows no count badges until the KPIs have loaded, but keeps the fixed AI label', () => {
    const b = badges();
    expect(b['Transactions']).toBeNull();
    expect(b['Fraud Alerts']).toBeNull();
    expect(b['Investigations']).toBeNull();
    expect(b['AI Investigator']).toBe('AI');
  });

  it('shows the live counts from the dashboard KPIs', () => {
    withKpis({ totalTransactions: 8, openAlertsCount: 5, activeInvestigationsCount: 4 });
    const b = badges();
    expect(b['Transactions']).toBe('8');
    expect(b['Fraud Alerts']).toBe('5');
    expect(b['Investigations']).toBe('4');
  });

  it('hides a badge when its count is zero and caps large counts at 99+', () => {
    withKpis({ totalTransactions: 1250, openAlertsCount: 0, activeInvestigationsCount: 100 });
    const b = badges();
    expect(b['Transactions']).toBe('99+');
    expect(b['Fraud Alerts']).toBeNull();
    expect(b['Investigations']).toBe('99+');
  });

  it('updates when the KPIs change (signal driven)', () => {
    withKpis({ openAlertsCount: 2 });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const alerts = c.navItems.find(i => i.label === 'Fraud Alerts')!;
    expect(c.badgeFor(alerts)).toBe('2');
    withKpis({ openAlertsCount: 7 });
    expect(c.badgeFor(alerts)).toBe('7');
  });
});
