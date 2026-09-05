import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FraudAlertService } from './fraud-alert.service';
import { environment } from '../../environments/environment';
import { ApiResponse, PagedResult, FraudAlertDto } from '../models/api-response.model';

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
      imports: [HttpClientTestingModule],
      providers: [FraudAlertService]
    });

    service = TestBed.inject(FraudAlertService);
    httpMock = TestBed.inject(HttpTestingController);

    // Drain initial loadAlerts
    const initReq = httpMock.expectOne(req => req.url.includes('/api/fraud-alerts'));
    initReq.flush(mockPagedResponse);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and load alerts from backend', () => {
    expect(service).toBeTruthy();
    expect(service.alerts().length).toBe(1);
    expect(service.alerts()[0].id).toBe('ALT-2026-0891');
    expect(service.alerts()[0].status).toBe('Open');
  });

  it('should resolve alert via PATCH /api/fraud-alerts/:id/resolve', () => {
    const resolveResponse: ApiResponse<FraudAlertDto> = {
      success: true,
      message: 'Alert resolved',
      timestamp: '2026-09-03T12:00:00Z',
      data: { ...mockAlertDto, status: 'Resolved' }
    };

    service.resolveAlert('ALT-2026-0891', 'Investigator cleared').subscribe(res => {
      expect(res.success).toBeTrue();
      expect(service.alerts()[0].status).toBe('Resolved');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/fraud-alerts/ALT-2026-0891/resolve`);
    expect(req.request.method).toBe('PATCH');
    req.flush(resolveResponse);
  });
});
