import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FraudAlertService, mapDtoToAlert } from './fraud-alert.service';
import { environment } from '../../environments/environment';
import { ApiResponse, PagedResult, FraudAlertDto } from '../models/api-response.model';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('FraudAlertService', () => {
  let service: FraudAlertService;
  let httpMock: HttpTestingController;

  const mockAlertDto: FraudAlertDto = {
    alertId: 'alert-1',
    alertCode: 'ALT-2026-0891',
    transactionId: 'txn-1',
    transactionCode: 'TXN-001',
    customerId: 'cust-1',
    customerName: 'Arjun Mehta',
    amountInr: 875000,
    fraudProbability: 97.2,
    riskTier: 'Critical',
    severity: 'Critical',
    reason: 'Velocity spike via VPN',
    status: 'Open',
    assignedTo: 'Riya Desai',
    location: 'Tbilisi, Georgia',
    alertType: 'Velocity Anomaly',
    createdAt: '2026-09-03T12:00:00Z',
    createdDateFormatted: 'Sep 03, 2026',
    createdTimeFormatted: '12:00:00'
  };

  const mockPagedResponse: ApiResponse<PagedResult<FraudAlertDto>> = {
    success: true,
    message: 'Success',
    timestamp: '2026-09-03T12:00:00Z',
    data: {
      items: [mockAlertDto],
      totalCount: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [FraudAlertService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});

    service = TestBed.inject(FraudAlertService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  function loadAlerts(): void {
    service.loadAlerts().subscribe();
    httpMock.expectOne(req => req.url.includes('/api/fraud-alerts')).flush(mockPagedResponse);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and load alerts from backend', () => {
    expect(service).toBeTruthy();
    loadAlerts();
    expect(service.alerts().length).toBe(1);
    expect(service.alerts()[0].id).toBe('ALT-2026-0891');
    expect(service.alerts()[0].status).toBe('Open');
  });

  it('should resolve alert via PATCH /api/fraud-alerts/:id/resolve', () => {
    loadAlerts();
    const resolveResponse: ApiResponse<FraudAlertDto> = {
      success: true,
      message: 'Alert resolved',
      timestamp: '2026-09-03T12:00:00Z',
      data: { ...mockAlertDto, status: 'Resolved' }
    };

    service.resolveAlert('ALT-2026-0891', 'FALSE_POSITIVE', '  Investigator cleared ').subscribe(res => {
      expect(res.success).toBeTrue();
      expect(service.alerts()[0].status).toBe('Resolved');
      expect(service.alerts()[0].outcome).toBe('FALSE_POSITIVE');
    });

    // the API takes the alert's GUID, not the display code
    const req = httpMock.expectOne(`${environment.apiUrl}/fraud-alerts/alert-1/resolve`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ outcome: 'FALSE_POSITIVE', notes: 'Investigator cleared' });
    req.flush(resolveResponse);
  });

  it('should send the verdict and no note when the analyst wrote none', () => {
    loadAlerts();
    service.resolveAlert('ALT-2026-0891', 'CONFIRMED_FRAUD').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/fraud-alerts/alert-1/resolve`);
    expect(req.request.body).toEqual({ outcome: 'CONFIRMED_FRAUD', notes: null });
    req.flush({ success: true, message: 'ok', timestamp: 't', data: mockAlertDto });
  });

  it('should map the stored verdict from the API', () => {
    expect(mapDtoToAlert({ ...mockAlertDto, status: 'Resolved', outcome: 'CONFIRMED_FRAUD' }).outcome).toBe('CONFIRMED_FRAUD');
    expect(mapDtoToAlert({ ...mockAlertDto, outcome: 'garbage' }).outcome).toBeNull();
    expect(mapDtoToAlert(mockAlertDto).alertGuid).toBe('alert-1');
  });
});
