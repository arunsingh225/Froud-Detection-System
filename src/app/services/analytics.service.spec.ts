import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { EngineHealthDto, FraudModelInfoDto } from '../models/api-response.model';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

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
    imports: [],
    providers: [
        AnalyticsService,
        { provide: AuthService, useValue: { isLoggedIn: () => auth.loggedIn, hasAnyRole: () => !!auth.privileged } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
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

  it('loads the alert feedback metrics into a signal', () => {
    const service = setup({ loggedIn: false });
    const metrics = {
      resolvedAlerts: 4, labelled: 4, confirmedFraud: 3, falsePositives: 1, precisionPercent: 75, minLabelsForReliableMetric: 30,
      reliable: false, bySeverity: [], byProbabilityBand: []
    };
    let result: unknown;
    service.getFeedbackMetrics().subscribe(r => (result = r));
    const req = httpMock.expectOne(environment.apiUrl + '/analytics/feedback');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', timestamp: 't', data: metrics });

    expect(result).toEqual(metrics);
    expect(service.feedbackMetrics()?.precisionPercent).toBe(75);
  });

  it('leaves the feedback metrics empty when the request fails', () => {
    const service = setup({ loggedIn: false });
    service.getFeedbackMetrics().subscribe();
    httpMock.expectOne(environment.apiUrl + '/analytics/feedback').flush(null, { status: 500, statusText: 'err' });
    expect(service.feedbackMetrics()).toBeNull();
  });

  it('downloads the labelled alerts as a file from the export endpoint', () => {
    const service = setup({ loggedIn: false });
    service.exportFeedbackCsv().subscribe();
    const req = httpMock.expectOne(environment.apiUrl + '/analytics/feedback/export');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['AlertCode,Label']));
  });
});
