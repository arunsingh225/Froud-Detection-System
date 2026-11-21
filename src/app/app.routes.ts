import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'transactions',
    loadComponent: () => import('./pages/transactions/transactions-list.component').then(m => m.TransactionsListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'transactions/:id',
    loadComponent: () => import('./pages/transactions/transaction-detail.component').then(m => m.TransactionDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'fraud-alerts',
    loadComponent: () => import('./pages/fraud-alerts/fraud-alerts.component').then(m => m.FraudAlertsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'investigations',
    loadComponent: () => import('./pages/investigations/investigations-list.component').then(m => m.InvestigationsListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'investigations/:id',
    loadComponent: () => import('./pages/investigations/investigation-detail.component').then(m => m.InvestigationDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'investigation-reports',
    loadComponent: () => import('./pages/investigation-reports/investigation-reports.component').then(m => m.InvestigationReportsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'ai-investigator',
    loadComponent: () => import('./pages/ai-investigator/ai-investigator.component').then(m => m.AiInvestigatorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'customers',
    loadComponent: () => import('./pages/customers/customers-list.component').then(m => m.CustomersListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'customers/:id',
    loadComponent: () => import('./pages/customers/customer-detail.component').then(m => m.CustomerDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'risk-analytics',
    loadComponent: () => import('./pages/risk-analytics/risk-analytics.component').then(m => m.RiskAnalyticsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'audit-logs',
    loadComponent: () => import('./pages/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'COMPLIANCE'] }
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
