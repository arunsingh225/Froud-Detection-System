import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CustomerService } from './customer.service';
import { environment } from '../../environments/environment';
import { ApiResponse, PagedResult, CustomerDto } from '../models/api-response.model';

describe('CustomerService', () => {
  let service: CustomerService;
  let httpMock: HttpTestingController;

  const mockCustomerDto: CustomerDto = {
    customerId: 'cust-1',
    customerCode: 'CUS-2026-4821',
    fullName: 'Arjun Mehta',
    email: 'arjun.mehta@proton.me',
    phone: '+91-98201-44821',
    riskScore: 97,
    riskTier: 'Critical',
    status: 'Under Review',
    kycStatus: 'Verified',
    city: 'Mumbai',
    country: 'India',
    residence: 'Mumbai, India',
    vol30d: 1875000,
    avgTxn: 28000,
    knownDevicesCount: 1,
    priorFlags: 4,
    createdAt: '2023-01-01T00:00:00Z'
  };

  const mockPagedResponse: ApiResponse<PagedResult<CustomerDto>> = {
    success: true,
    message: 'Success',
    timestamp: '2026-09-03T12:00:00Z',
    data: {
      items: [mockCustomerDto],
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
      providers: [CustomerService]
    });

    service = TestBed.inject(CustomerService);
    httpMock = TestBed.inject(HttpTestingController);

    // Drain initial loadCustomers
    const initReq = httpMock.expectOne(req => req.url.includes('/api/customers'));
    initReq.flush(mockPagedResponse);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and load customers from backend', () => {
    expect(service).toBeTruthy();
    expect(service.customers().length).toBe(1);
    expect(service.customers()[0].name).toBe('Arjun Mehta');
    expect(service.customers()[0].riskTier).toBe('Critical');
  });

  it('should select customer into signal', () => {
    const cust = service.customers()[0];
    service.selectCustomer(cust);
    expect(service.selectedCustomer()?.id).toBe('CUS-2026-4821');
  });
});
