import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map, interval, switchMap, startWith } from 'rxjs';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { AuditLogItem } from '../models/audit-log.model';
import { InvestigationReport } from '../models/report.model';
import { AppNotification } from '../models/notification.model';
import {
  ApiResponse,
  PagedResult,
  AuditLogDto,
  ReportDto,
  CreateReportDto,
  EngineHealthDto,
  FraudModelInfoDto
} from '../models/api-response.model';
import {
  AdvancedDashboardKpis,
  FraudTrendPoint,
  FraudTrendResponse,
  RiskDistribution,
  CategoryRiskItem,
  GeographicRiskItem,
  MerchantRiskItem,
  CustomerRiskItem,
  DeviceRiskItem,
  AlertAnalytics,
  InvestigationAnalytics,
  ModelMonitoringData,
  LiveAlertItem,
  OperationalHealthStatus
} from '../models/advanced-analytics.model';

export function mapDtoToAuditLog(dto: AuditLogDto): AuditLogItem {
  return {
    id: dto.auditCode || dto.auditLogId.toString(),
    timestamp: dto.timestamp,
    date: dto.date || new Date(dto.timestamp).toLocaleDateString(),
    time: dto.time || new Date(dto.timestamp).toLocaleTimeString(),
    actor: {
      name: dto.actorName || 'System',
      type: (dto.actorType as any) || 'SERVICE',
      icon: dto.actorType === 'AI AGENT' ? 'smart_toy' : dto.actorType === 'INVESTIGATOR' ? 'person' : 'shield'
    },
    action: dto.action,
    subAction: dto.subAction,
    resource: dto.resourceTarget,
    result: (dto.result as any) || 'SUCCESS',
    category: (dto.category as any) || 'Investigation'
  };
}

export function mapDtoToReport(dto: ReportDto): InvestigationReport {
  return {
    id: dto.reportCode || dto.reportId,
    entityId: dto.entityId || 'N/A',
    entityName: dto.entityName || 'Case Entity',
    title: dto.title,
    riskLevel: (dto.riskLevel as any) || 'HIGH',
    generatedBy: dto.generatedBy,
    isAiGenerated: dto.generatedBy.toLowerCase().includes('ai') || dto.generatedBy.toLowerCase().includes('copilot'),
    date: new Date(dto.createdAt).toLocaleDateString(),
    time: new Date(dto.createdAt).toLocaleTimeString(),
    status: (dto.status as any) || 'Published',
    category: (dto.category as any) || 'SAR Report',
    summary: dto.summary,
    findingsCount: dto.findingsCount || 3
  };
}

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Reactive Signals for Phase 10 Analytics
  advancedKpis = signal<AdvancedDashboardKpis | null>(null);
  fraudTrends = signal<FraudTrendPoint[]>([]);
  riskDistribution = signal<RiskDistribution | null>(null);
  categoryRisk = signal<CategoryRiskItem[]>([]);
  geographicRisk = signal<GeographicRiskItem[]>([]);
  merchantRisk = signal<MerchantRiskItem[]>([]);
  deviceRisk = signal<DeviceRiskItem[]>([]);
  alertAnalytics = signal<AlertAnalytics | null>(null);
  investigationAnalytics = signal<InvestigationAnalytics | null>(null);
  modelMonitoring = signal<ModelMonitoringData | null>(null);
  liveAlerts = signal<LiveAlertItem[]>([]);
  operationalHealth = signal<OperationalHealthStatus | null>(null);

  // Legacy Signals for existing components
  dashboardKpis = signal<any | null>(null);
  engineHealth = signal<EngineHealthDto | null>(null);
  modelInfo = signal<FraudModelInfoDto | null>(null);
  auditLogs = signal<AuditLogItem[]>([]);
  reports = signal<InvestigationReport[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  readonly notifications = signal<AppNotification[]>([]);
  private hubConnection: HubConnection | null = null;

  private getStoredReadIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('fraudguard_read_notifications');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  }

  private saveStoredReadIds(ids: Set<string>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('fraudguard_read_notifications', JSON.stringify(Array.from(ids)));
    } catch (e) {
      console.warn('[AnalyticsService] Failed to persist read notifications:', e);
    }
  }

  private calculateTimeAgo(timestampStr: string): string {
    const now = Date.now();
    const created = new Date(timestampStr).getTime();
    if (isNaN(created)) return 'Just now';
    const diffMinutes = Math.floor((now - created) / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private mapSeverity(sev?: string): 'critical' | 'high' | 'medium' | 'info' {
    const s = (sev || '').toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'medium') return 'medium';
    return 'info';
  }

  syncNotifications(alerts: LiveAlertItem[]): void {
    const readIds = this.getStoredReadIds();
    const mapped: AppNotification[] = (alerts || []).map(alert => {
      const notifId = alert.alertId || alert.alertCode;
      const isCriticalOrHigh = alert.severity?.toLowerCase() === 'critical' || alert.severity?.toLowerCase() === 'high';
      return {
        id: notifId,
        title: `${isCriticalOrHigh ? '🚨 ' : ''}Alert ${alert.alertCode}: ${alert.customerName || 'Suspect'}`,
        description: alert.reason || `Transaction ${alert.transactionCode} flagged (₹${alert.amountInr.toLocaleString('en-IN')})`,
        type: 'alert' as const,
        severity: this.mapSeverity(alert.severity),
        isRead: readIds.has(notifId) || readIds.has(alert.alertCode),
        timestamp: alert.createdAt,
        timeAgo: this.calculateTimeAgo(alert.createdAt),
        routePath: alert.transactionId ? `/transactions/${alert.transactionId}` : `/fraud-alerts`,
        relatedId: alert.alertId
      };
    });

    // Deduplicate by ID
    const uniqueMap = new Map<string, AppNotification>();
    for (const notif of mapped) {
      if (!uniqueMap.has(notif.id)) {
        uniqueMap.set(notif.id, notif);
      }
    }

    this.notifications.set(Array.from(uniqueMap.values()));
  }

  markAllNotificationsRead(): void {
    const readIds = this.getStoredReadIds();
    const current = this.notifications();
    for (const notif of current) {
      readIds.add(notif.id);
    }
    this.saveStoredReadIds(readIds);
    this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
  }

  markNotificationRead(id: string): void {
    const readIds = this.getStoredReadIds();
    readIds.add(id);
    this.saveStoredReadIds(readIds);
    this.notifications.update(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  }

  private initSignalR(): void {
    if (typeof window === 'undefined') return;
    try {
      const hubUrl = environment.apiUrl.replace('/api', '') + '/hubs/analytics';
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => (typeof localStorage !== 'undefined' ? localStorage.getItem('fraudguard_token') || '' : '')
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.None)
        .build();

      this.hubConnection.on('AnalyticsUpdated', () => {
        this.loadDashboardData();
      });

      this.hubConnection.on('NewAlertFlagged', () => {
        this.getLiveAlerts(10).subscribe();
        this.getDashboardKpis().subscribe();
      });

      this.hubConnection.start().catch(() => {
        // Resilient fallback: Polling interval handles live updates
      });
    } catch {
      // Ignore initial connection errors
    }
  }

  constructor() {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('fraudguard_token')) {
      this.loadDashboardData();
    }
    this.initRealTimePolling();
    this.initSignalR();
  }

  loadDashboardData(): void {
    if (typeof localStorage === 'undefined' || !localStorage.getItem('fraudguard_token')) {
      return;
    }
    this.loading.set(true);
    this.getDashboardKpis().subscribe();
    this.getFraudTrends('7d').subscribe();
    this.getRiskDistribution().subscribe();
    this.getLiveAlerts(10).subscribe();
    this.getOperationalHealth().subscribe();
    this.getModelMonitoring().subscribe();
    this.getMerchantRisk().subscribe();

    // Only load ML engine health and model specs if user is authorized (ADMIN or COMPLIANCE)
    if (this.authService.hasAnyRole(['ADMIN', 'COMPLIANCE'])) {
      this.getEngineHealth().subscribe();
      this.getModelInfo().subscribe();
    }
  }

  private initRealTimePolling(): void {
    // 10-second resilient polling interval for live queue and KPI updates (active only when logged in)
    interval(10000).pipe(
      switchMap(() => {
        if (typeof localStorage === 'undefined' || !localStorage.getItem('fraudguard_token')) {
          return of([]);
        }
        return this.getLiveAlerts(10);
      })
    ).subscribe();

    interval(15000).pipe(
      switchMap(() => {
        if (typeof localStorage === 'undefined' || !localStorage.getItem('fraudguard_token')) {
          return of(null);
        }
        return this.getDashboardKpis();
      })
    ).subscribe();
  }

  getDashboardKpis(): Observable<AdvancedDashboardKpis | null> {
    return this.http.get<ApiResponse<AdvancedDashboardKpis>>(`${environment.apiUrl}/analytics/dashboard`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.advancedKpis.set(res.data);
          this.dashboardKpis.set(res.data); // Keep legacy signal synced
          this.loading.set(false);
          return res.data;
        }
        return null;
      }),
      catchError(err => {
        console.warn('[AnalyticsService] Error fetching dashboard KPIs:', err);
        this.loading.set(false);
        return of(null);
      })
    );
  }

  getFraudTrends(period: string = '7d'): Observable<FraudTrendPoint[]> {
    const params = new HttpParams().set('period', period);
    return this.http.get<ApiResponse<FraudTrendResponse>>(`${environment.apiUrl}/analytics/fraud-trends`, { params }).pipe(
      map(res => {
        if (res.success && res.data && res.data.points) {
          this.fraudTrends.set(res.data.points);
          return res.data.points;
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getRiskDistribution(): Observable<RiskDistribution | null> {
    return this.http.get<ApiResponse<RiskDistribution>>(`${environment.apiUrl}/analytics/risk-distribution`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.riskDistribution.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getCategoryRisk(): Observable<CategoryRiskItem[]> {
    return this.http.get<ApiResponse<CategoryRiskItem[]>>(`${environment.apiUrl}/analytics/fraud-by-category`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.categoryRisk.set(res.data);
          return res.data;
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getGeographicRisk(): Observable<GeographicRiskItem[]> {
    return this.http.get<ApiResponse<GeographicRiskItem[]>>(`${environment.apiUrl}/analytics/geographic-risk`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.geographicRisk.set(res.data);
          return res.data;
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getMerchantRisk(): Observable<MerchantRiskItem[]> {
    return this.http.get<ApiResponse<MerchantRiskItem[]>>(`${environment.apiUrl}/analytics/merchant-risk`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.merchantRisk.set(res.data);
          return res.data;
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getCustomerRisk(page: number = 1, pageSize: number = 20): Observable<PagedResult<CustomerRiskItem> | null> {
    const params = new HttpParams().set('page', page.toString()).set('pageSize', pageSize.toString());
    return this.http.get<ApiResponse<PagedResult<CustomerRiskItem>>>(`${environment.apiUrl}/analytics/customer-risk`, { params }).pipe(
      map(res => res.success && res.data ? res.data : null),
      catchError(() => of(null))
    );
  }

  getDeviceRisk(): Observable<DeviceRiskItem[]> {
    return this.http.get<ApiResponse<DeviceRiskItem[]>>(`${environment.apiUrl}/analytics/device-risk`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.deviceRisk.set(res.data);
          return res.data;
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getAlertAnalytics(): Observable<AlertAnalytics | null> {
    return this.http.get<ApiResponse<AlertAnalytics>>(`${environment.apiUrl}/analytics/alerts`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.alertAnalytics.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getInvestigationAnalytics(): Observable<InvestigationAnalytics | null> {
    return this.http.get<ApiResponse<InvestigationAnalytics>>(`${environment.apiUrl}/analytics/investigations`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.investigationAnalytics.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getModelMonitoring(): Observable<ModelMonitoringData | null> {
    return this.http.get<ApiResponse<ModelMonitoringData>>(`${environment.apiUrl}/analytics/model-monitoring`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.modelMonitoring.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getLiveAlerts(limit: number = 10): Observable<LiveAlertItem[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<LiveAlertItem[]>>(`${environment.apiUrl}/analytics/live-alerts`, { params }).pipe(
      map(res => {
        if (res.success && res.data) {
          this.liveAlerts.set(res.data);
          this.syncNotifications(res.data);
          return res.data;
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  refreshNotifications(): Observable<LiveAlertItem[]> {
    return this.getLiveAlerts(10);
  }

  getOperationalHealth(): Observable<OperationalHealthStatus | null> {
    return this.http.get<ApiResponse<OperationalHealthStatus>>(`${environment.apiUrl}/analytics/operational-health`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.operationalHealth.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  exportDataCsv(type: string = 'fraud-alerts'): Observable<Blob> {
    const params = new HttpParams().set('type', type).set('format', 'csv');
    return this.http.get(`${environment.apiUrl}/analytics/export`, {
      params,
      responseType: 'blob'
    });
  }

  // Legacy Methods for Backward Compatibility
  getEngineHealth(): Observable<EngineHealthDto | null> {
    if (!this.authService.hasAnyRole(['ADMIN', 'COMPLIANCE'])) {
      return of(null);
    }
    return this.http.get<ApiResponse<EngineHealthDto>>(`${environment.apiUrl}/fraud/engine-health`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.engineHealth.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getModelInfo(): Observable<FraudModelInfoDto | null> {
    if (!this.authService.hasAnyRole(['ADMIN', 'COMPLIANCE'])) {
      return of(null);
    }
    return this.http.get<ApiResponse<FraudModelInfoDto>>(`${environment.apiUrl}/fraud/model-info`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.modelInfo.set(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getAuditLogs(category?: string, result?: string, page: number = 1, pageSize: number = 50): Observable<AuditLogItem[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    if (category && category !== 'All') params = params.set('category', category);
    if (result && result !== 'All') params = params.set('result', result);

    return this.http.get<ApiResponse<PagedResult<AuditLogDto>>>(`${environment.apiUrl}/audit-logs`, { params }).pipe(
      map(res => {
        if (res.success && res.data && res.data.items) {
          const mapped = res.data.items.map(mapDtoToAuditLog);
          this.auditLogs.set(mapped);
          return mapped;
        }
        return [];
      }),
      catchError(() => of(this.auditLogs()))
    );
  }

  getReports(category?: string, status?: string, page: number = 1, pageSize: number = 50): Observable<InvestigationReport[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    if (category && category !== 'All') params = params.set('category', category);
    if (status && status !== 'All') params = params.set('status', status);

    return this.http.get<ApiResponse<PagedResult<ReportDto>>>(`${environment.apiUrl}/reports`, { params }).pipe(
      map(res => {
        if (res.success && res.data && res.data.items) {
          const mapped = res.data.items.map(mapDtoToReport);
          this.reports.set(mapped);
          return mapped;
        }
        return [];
      }),
      catchError(() => of(this.reports()))
    );
  }

  createReport(payload: CreateReportDto): Observable<InvestigationReport | null> {
    return this.http.post<ApiResponse<ReportDto>>(`${environment.apiUrl}/reports`, payload).pipe(
      map(res => {
        if (res.success && res.data) {
          const report = mapDtoToReport(res.data);
          this.reports.update(curr => [report, ...curr]);
          return report;
        }
        return null;
      }),
      catchError(err => {
        console.error('[AnalyticsService] Failed to create report:', err);
        return of(null);
      })
    );
  }

  exportData(type: string = 'transactions', format: string = 'csv'): Observable<Blob> {
    const params = new HttpParams().set('type', type).set('format', format);
    return this.http.get(`${environment.apiUrl}/analytics/export`, {
      params,
      responseType: 'blob'
    });
  }

  // Format Helpers
  formatCurrency(value: number): string {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  }

  formatUsd(value: number): string {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(2)}`;
  }
}
