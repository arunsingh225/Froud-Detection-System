import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Investigation, TimelineStep, EvidenceCategory } from '../models/investigation.model';
import {
  ApiResponse,
  PagedResult,
  InvestigationDto,
  InvestigationDetailDto
} from '../models/api-response.model';
import { RiskTier, InvestigationStatus, InvestigationPriority } from '../models/types.model';

export function mapDtoToInvestigation(dto: InvestigationDto): Investigation {
  return {
    id: dto.investigationCode || dto.investigationId,
    transactionId: dto.transactionCode || dto.transactionId,
    customerId: dto.customerId,
    customerName: dto.customerName || 'Unknown Customer',
    riskTier: (dto.riskTier as RiskTier) || 'High',
    fraudProbability: dto.fraudProbability,
    priority: (dto.priority as InvestigationPriority) || 'High',
    assignedInvestigator: dto.assignedInvestigator || 'Unassigned',
    status: (dto.status as InvestigationStatus) || 'Investigating',
    createdDate: dto.createdAt ? new Date(dto.createdAt).toLocaleDateString() : 'Today',
    lastUpdated: dto.updatedAt ? new Date(dto.updatedAt).toLocaleTimeString() : 'Recently',
    amountInr: dto.amountInr,
    location: dto.location || 'Unknown Location',
    alertReason: dto.alertReason || 'Flagged for investigator review'
  };
}

@Injectable({
  providedIn: 'root'
})
export class InvestigationService {
  private readonly http = inject(HttpClient);

  // Reactive Signals
  investigations = signal<Investigation[]>([]);
  selectedInvestigation = signal<Investigation | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  totalCount = signal<number>(0);

  timelineSteps = signal<TimelineStep[]>([
    {
      id: 'step-1',
      label: 'AI Fraud Scoring Triggered',
      description: 'Transaction scored by LightGBM model with high fraud posterior probability.',
      timestamp: 'Today at 02:14:37 IST',
      status: 'completed',
      actor: 'ai'
    },
    {
      id: 'step-2',
      label: 'Fraud Alert Auto-Generated',
      description: 'High-risk anomaly alert generated and assigned to investigator queue.',
      timestamp: 'Today at 02:18:00 IST',
      status: 'completed',
      actor: 'system'
    },
    {
      id: 'step-3',
      label: 'Investigator Review in Progress',
      description: 'Analyst inspecting device telemetry, VPN metadata, and payment velocity.',
      timestamp: 'Active Now',
      status: 'active',
      actor: 'human'
    }
  ]);

  evidenceCategories = signal<EvidenceCategory[]>([
    {
      category: 'ML',
      icon: 'psychology',
      items: [
        {
          type: 'LightGBM Classifier',
          finding: 'Posterior probability exceeded 0.80 critical threshold.',
          confidence: 96,
          source: 'FastAPI AI Engine (Resident LightGBM)',
          timestamp: 'Inference at ingestion',
          severity: 'critical'
        }
      ]
    },
    {
      category: 'Device',
      icon: 'smartphone',
      items: [
        {
          type: 'Device Fingerprint',
          finding: 'Unregistered client signature with anonymous proxy/VPN routing.',
          confidence: 88,
          source: 'Network Telemetry Gateway',
          timestamp: 'Network handshake',
          severity: 'high'
        }
      ]
    }
  ]);

  constructor() {
    this.loadInvestigations();
  }

  loadInvestigations(
    status?: string,
    priority?: string,
    page: number = 1,
    pageSize: number = 50
  ): Observable<Investigation[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (status && status !== 'All') params = params.set('status', status);
    if (priority && priority !== 'All') params = params.set('priority', priority);

    return this.http.get<ApiResponse<PagedResult<InvestigationDto>>>(`${environment.apiUrl}/investigations`, { params }).pipe(
      map(res => {
        if (res && res.success && res.data && res.data.items) {
          const mapped = res.data.items.map(mapDtoToInvestigation);
          this.investigations.set(mapped);
          this.totalCount.set(res.data.totalCount);
          if (!this.selectedInvestigation() && mapped.length > 0) {
            this.selectedInvestigation.set(mapped[0]);
          }
          this.loading.set(false);
          return mapped;
        }
        this.loading.set(false);
        return [];
      }),
      catchError(err => {
        this.loading.set(false);
        this.error.set(err.message || 'Failed to load investigations');
        return of(this.investigations());
      })
    );
  }

  getInvestigations(): Investigation[] {
    return this.investigations();
  }

  selectInvestigation(inv: Investigation): void {
    this.selectedInvestigation.set(inv);
  }

  get timeline(): TimelineStep[] {
    return this.timelineSteps();
  }

  get evidence(): EvidenceCategory[] {
    return this.evidenceCategories();
  }

  getInvestigationById(id: string): Investigation | undefined {
    const cached = this.investigations().find(
      inv => inv.id.toLowerCase() === id.toLowerCase() || (inv as any).investigationId === id
    );
    if (cached) {
      this.selectedInvestigation.set(cached);
      return cached;
    }

    this.http.get<ApiResponse<InvestigationDetailDto>>(`${environment.apiUrl}/investigations/${id}`).subscribe({
      next: res => {
        if (res.success && res.data) {
          const mapped = mapDtoToInvestigation(res.data);
          this.selectedInvestigation.set(mapped);
          this.investigations.update(prev => [mapped, ...prev.filter(i => i.id !== mapped.id)]);
        }
      },
      error: err => console.error('[InvestigationService] Failed to load investigation by ID:', err)
    });

    return cached;
  }

  submitDecision(id: string, decision: string, notes: string): Observable<ApiResponse<InvestigationDto>> {
    return this.http.patch<ApiResponse<InvestigationDto>>(`${environment.apiUrl}/investigations/${id}/decision`, {
      decision,
      notes
    }).pipe(
      tap(() => {
        this.investigations.update(list =>
          list.map(i => (i.id.toLowerCase() === id.toLowerCase() ? { ...i, status: 'Closed' as InvestigationStatus } : i))
        );
      })
    );
  }
}
