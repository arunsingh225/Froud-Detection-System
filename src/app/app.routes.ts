import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TransactionsListComponent } from './pages/transactions/transactions-list.component';
import { TransactionDetailComponent } from './pages/transactions/transaction-detail.component';
import { FraudAlertsComponent } from './pages/fraud-alerts/fraud-alerts.component';
import { InvestigationsListComponent } from './pages/investigations/investigations-list.component';
import { InvestigationDetailComponent } from './pages/investigations/investigation-detail.component';
import { InvestigationReportsComponent } from './pages/investigation-reports/investigation-reports.component';
import { AiInvestigatorComponent } from './pages/ai-investigator/ai-investigator.component';
import { CustomersListComponent } from './pages/customers/customers-list.component';
import { CustomerDetailComponent } from './pages/customers/customer-detail.component';
import { RiskAnalyticsComponent } from './pages/risk-analytics/risk-analytics.component';
import { AuditLogsComponent } from './pages/audit-logs/audit-logs.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'transactions',
    component: TransactionsListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'transactions/:id',
    component: TransactionDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'fraud-alerts',
    component: FraudAlertsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'investigations',
    component: InvestigationsListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'investigations/:id',
    component: InvestigationDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'investigation-reports',
    component: InvestigationReportsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'ai-investigator',
    component: AiInvestigatorComponent,
    canActivate: [authGuard]
  },
  {
    path: 'customers',
    component: CustomersListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'customers/:id',
    component: CustomerDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'risk-analytics',
    component: RiskAnalyticsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'audit-logs',
    component: AuditLogsComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'COMPLIANCE'] }
  },
  {
    path: 'settings',
    component: SettingsComponent,
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
