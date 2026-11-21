import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { EngineHealthDto, FraudModelInfoDto } from '../models/api-response.model';

describe('AnalyticsService', () => {
  let httpMock: HttpTestingController;

  const mockKpis = { totalTransactions: 1200, fraudFlaggedCount: 142, totalTransactionValueUsd: 42800000 };
  const mockEngineHealth: EngineHealthDto = {
    aspNetCore: 'healthy', fastApi: 'healthy', modelLoaded: true,
    checkedAt: '2026-09-03T12:00:00Z', message: 'Operational'
  };
  const mockModelInfo: FraudModelInfoDto = {
    modelName: 'LightGBM_Fraud_Classifier', modelVersion: '1.0', rocAuc: 0.9168, prAuc: 0.5393,
    threshold: 0.80, featureCount: 464, trainingDate: '2026-09-03'
  };

  function setup(auth: { loggedIn: boolean; privileged?: boolean }): AnalyticsService {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AnalyticsService,
        { provide: AuthService, useValue: { isLoggedIn: () => auth.loggedIn, hasAnyRole: () => !!auth.privileged } }
      ]
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(AnalyticsService);
  }

  /** Answer the known endpoints; every other startup call gets an unsuccessful envelope (handled by the service). */
  function respondToStartupCalls(): void {
    for (const req of httpMock.match(() => true)) {
      const url = req.request.url;
      if (url === environment.apiUrl + '/analytics/dashboard') req.flush({ success: true, data: mockKpis });
      else if (url === environment.apiUrl + '/fraud/engine-health') req.flush({ success: true, data: mockEngineHealth });
      else if (url === environment.apiUrl + '/fraud/model-info') req.flush({ success: true, data: mockModelInfo });
      else req.flush({ success: false });
    }
  }

  afterEach(() => httpMock.verify());

  it('loads dashboard KPIs for a logged-in user', () => {
    const service = setup({ loggedIn: true });
    respondToStartupCalls();
    expect(service.dashboardKpis()?.fraudFlaggedCount).toBe(142);
  });

  it('loads engine health and model provenance only for ADMIN/COMPLIANCE', () => {
    const service = setup({ loggedIn: true, privileged: true });
    respondToStartupCalls();
    expect(service.engineHealth()?.fastApi).toBe('healthy');
    expect(service.engineHealth()?.modelLoaded).toBeTrue();
    expect(service.modelInfo()?.modelName).toBe('LightGBM_Fraud_Classifier');
    expect(service.modelInfo()?.featureCount).toBe(464);
  });

  it('does not request privileged endpoints for other roles', () => {
    setup({ loggedIn: true, privileged: false });
    const urls = httpMock.match(() => true).map(r => r.request.url);
    expect(urls).not.toContain(environment.apiUrl + '/fraud/engine-health');
    expect(urls).not.toContain(environment.apiUrl + '/fraud/model-info');
  });

  it('makes no API calls when logged out', () => {
    setup({ loggedIn: false });
    httpMock.expectNone(() => true);
  });
});
