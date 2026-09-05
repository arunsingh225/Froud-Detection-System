import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { environment } from '../../environments/environment';
import { ApiResponse, DashboardKpisDto, EngineHealthDto, FraudModelInfoDto } from '../models/api-response.model';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;

  const mockKpis: DashboardKpisDto = {
    totalMonitoredVolumeInr: 3500000000,
    totalMonitoredVolumeUsd: 42800000,
    flaggedTransactionsCount: 142,
    activeInvestigationsCount: 36,
    preventedFraudLossInr: 680000000,
    preventedFraudLossUsd: 8200000,
    aiAssistedPercentage: 89.0,
    threatBreakdown: {
      accountTakeoverCount: 42,
      velocitySpikesCount: 68,
      syntheticIdentityCount: 19,
      cardTestingCount: 13
    }
  };

  const mockEngineHealth: EngineHealthDto = {
    aspNetCore: 'healthy',
    fastApi: 'healthy',
    modelLoaded: true,
    checkedAt: '2026-09-03T12:00:00Z',
    message: 'Operational'
  };

  const mockModelInfo: FraudModelInfoDto = {
    modelName: 'LightGBM_Fraud_Classifier',
    modelVersion: '1.0',
    rocAuc: 0.9168,
    prAuc: 0.5393,
    threshold: 0.80,
    featureCount: 464,
    trainingDate: '2026-09-03'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AnalyticsService]
    });

    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);

    // Drain initial dashboard calls
    const kpiReq = httpMock.expectOne(`${environment.apiUrl}/analytics/dashboard`);
    kpiReq.flush({ success: true, data: mockKpis });

    const healthReq = httpMock.expectOne(`${environment.apiUrl}/fraud/engine-health`);
    healthReq.flush({ success: true, data: mockEngineHealth });

    const modelReq = httpMock.expectOne(`${environment.apiUrl}/fraud/model-info`);
    modelReq.flush({ success: true, data: mockModelInfo });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and load real dashboard KPIs', () => {
    expect(service).toBeTruthy();
    expect(service.dashboardKpis()?.flaggedTransactionsCount).toBe(142);
    expect(service.dashboardKpis()?.totalMonitoredVolumeUsd).toBe(42800000);
  });

  it('should track resident AI engine health status', () => {
    expect(service.engineHealth()?.aspNetCore).toBe('healthy');
    expect(service.engineHealth()?.fastApi).toBe('healthy');
    expect(service.engineHealth()?.modelLoaded).toBeTrue();
  });

  it('should fetch model provenance metadata', () => {
    expect(service.modelInfo()?.modelName).toBe('LightGBM_Fraud_Classifier');
    expect(service.modelInfo()?.rocAuc).toBe(0.9168);
    expect(service.modelInfo()?.threshold).toBe(0.80);
    expect(service.modelInfo()?.featureCount).toBe(464);
  });
});
