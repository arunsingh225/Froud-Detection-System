import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertOutcome, FraudAlert } from '../models/alert.model';
import { ApiResponse, PagedResult, FraudAlertDto } from '../models/api-response.model';
import { AlertStatus } from '../models/types.model';
import { asUnion } from '../shared/utils/cast';

export function mapDtoToAlert(dto: FraudAlertDto): FraudAlert {
  return {
    id: dto.alertCode || dto.alertId,
    alertGuid: dto.alertId,
    transactionId: dto.transactionCode || dto.transactionId,
    customerId: dto.customerId,
    customerName: dto.customerName || 'Unknown Customer',
    amountInr: dto.amountInr,
    fraudProbability: dto.fraudProbability,
    riskTier: asUnion<FraudAlert['riskTier']>(dto.riskTier || dto.severity, 'Medium'),
    reason: dto.reason,
    status: asUnion<FraudAlert['status']>(dto.status, 'Open'),
    outcome: dto.outcome === 'CONFIRMED_FRAUD' || dto.outcome === 'FALSE_POSITIVE' ? dto.outcome : null,
    assignedTo: dto.assignedTo,
    createdAt: dto.createdDateFormatted || new Date(dto.createdAt).toLocaleDateString(),
    createdTime: dto.createdTimeFormatted || new Date(dto.createdAt).toLocaleTimeString(),
    location: dto.location || 'Unknown Location',
    alertType: dto.alertType || 'Suspicious Activity'
  };
}

@Injectable({
  providedIn: 'root'
})
export class FraudAlertService {
  private readonly http = inject(HttpClient);

  // Reactive Signals
  alerts = signal<FraudAlert[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  totalCount = signal<number>(0);

  loadAlerts(
    status?: string,
    severity?: string,
    page: number = 1,
    pageSize: number = 50
  ): Observable<FraudAlert[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (status && status !== 'All') params = params.set('status', status);
    if (severity && severity !== 'All') params = params.set('severity', severity);

    return this.http.get<ApiResponse<PagedResult<FraudAlertDto>>>(`${environment.apiUrl}/fraud-alerts`, { params }).pipe(
      map(res => {
        if (res && res.success && res.data && res.data.items) {
          const mapped = res.data.items.map(mapDtoToAlert);
          this.alerts.set(mapped);
          this.totalCount.set(res.data.totalCount);
          this.loading.set(false);
          return mapped;
        }
        this.loading.set(false);
        return [];
      }),
      catchError(err => {
        this.loading.set(false);
        this.error.set(err.message || 'Failed to load fraud alerts');
        return of(this.alerts());
      })
    );
  }

  getAlerts(): FraudAlert[] {
    return this.alerts();
  }

  getAlertById(id: string): FraudAlert | undefined {
    return this.alerts().find(a => a.id.toLowerCase() === id.toLowerCase() || (a as FraudAlert & { alertId?: string }).alertId === id);
  }

  /** The API addresses an alert by its GUID, while the screen shows (and the list keys on) the alert code. */
  private apiId(id: string): string {
    return this.getAlertById(id)?.alertGuid ?? id;
  }

  /** Resolves an alert with the analyst's verdict (confirmed fraud or false positive), which is stored as ground truth. */
  resolveAlert(id: string, outcome: AlertOutcome, notes?: string): Observable<ApiResponse<FraudAlertDto>> {
    return this.http.patch<ApiResponse<FraudAlertDto>>(`${environment.apiUrl}/fraud-alerts/${this.apiId(id)}/resolve`, {
      outcome,
      notes: notes?.trim() || null
    }).pipe(
      tap(() => {
        this.alerts.update(alerts =>
          alerts.map(a => (a.id.toLowerCase() === id.toLowerCase() ? { ...a, status: 'Resolved' as AlertStatus, outcome } : a))
        );
      })
    );
  }

  assignAlert(id: string, assignedUserId: string): Observable<ApiResponse<FraudAlertDto>> {
    return this.http.patch<ApiResponse<FraudAlertDto>>(`${environment.apiUrl}/fraud-alerts/${this.apiId(id)}/assign`, {
      assignedToUserId: assignedUserId
    }).pipe(
      tap(() => {
        this.alerts.update(alerts =>
          alerts.map(a => (a.id.toLowerCase() === id.toLowerCase() ? { ...a, status: 'Investigating' as AlertStatus } : a))
        );
      })
    );
  }
}
