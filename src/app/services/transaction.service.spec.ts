import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TransactionService } from './transaction.service';
import { environment } from '../../environments/environment';
import { ApiResponse, PagedResult, TransactionDto, CreateTransactionDto, FraudPredictionResultDto } from '../models/api-response.model';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;

  const mockTransactionDto: TransactionDto = {
    transactionId: '11111111-1111-1111-1111-111111111111',
    transactionCode: 'TXN-2026-000101',
    customerId: '22222222-2222-2222-2222-222222222222',
    customerName: 'Arjun Mehta',
    customerCode: 'CUS-001',
    amountInr: 850000,
    amountUsd: 10179,
    paymentMethod: 'Visa Credit',
    cardLast4: '9988',
    merchantName: 'CryptoSwap Pro',
    merchantCategory: 'Crypto',
    location: 'Tbilisi, Georgia',
    city: 'Tbilisi',
    country: 'Georgia',
    device: 'Unknown Android',
    ipAddress: '185.220.101.14',
    vpnDetected: true,
    probability: 97.2,
    riskTier: 'Critical',
    status: 'Investigating',
    anomalyReason: 'Velocity spike detected',
    formattedDate: 'Sep 03, 2026',
    formattedTime: '12:00:00',
    timestamp: '2026-09-03T12:00:00Z'
  };

  const mockPagedResponse: ApiResponse<PagedResult<TransactionDto>> = {
    success: true,
    message: 'Success',
    timestamp: '2026-09-03T12:00:00Z',
    data: {
      items: [mockTransactionDto],
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
      providers: [TransactionService]
    });

    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);

    // Drain constructor loadTransactions request
    const initReq = httpMock.expectOne(req => req.url.includes('/api/transactions'));
    initReq.flush(mockPagedResponse);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and use centralized environment apiUrl', () => {
    expect(service).toBeTruthy();
    expect(environment.apiUrl).toBe('http://localhost:5000/api');
  });

  it('should load transactions and populate reactive signals', () => {
    service.loadTransactions().subscribe(txns => {
      expect(txns.length).toBe(1);
      expect(txns[0].id).toBe('TXN-2026-000101');
      expect(txns[0].riskTier).toBe('Critical');
    });

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/transactions`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPagedResponse);

    expect(service.transactions().length).toBe(1);
    expect(service.loading()).toBeFalse();
  });

  it('should create new transaction and dispatch to backend for AI scoring', () => {
    const newTxnDto: CreateTransactionDto = {
      accountId: 'acc-1',
      customerId: 'cust-1',
      amountInr: 850000,
      paymentMethod: 'Visa Credit',
      cardLast4: '9988',
      ipAddress: '185.220.101.5',
      city: 'Moscow',
      country: 'Russia',
      distanceFromTypicalKm: 5200,
      vpnOrProxyDetected: true
    };

    const createResponse: ApiResponse<TransactionDto> = {
      success: true,
      message: 'Transaction ingested successfully.',
      timestamp: '2026-09-03T12:00:00Z',
      data: mockTransactionDto
    };

    service.createTransaction(newTxnDto).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.data.transactionCode).toBe('TXN-2026-000101');
      expect(res.data.probability).toBe(97.2);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/transactions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.amountInr).toBe(850000);
    req.flush(createResponse);
  });

  it('should handle API prediction requests', () => {
    const mockPredictionResult: ApiResponse<FraudPredictionResultDto> = {
      success: true,
      message: 'Prediction completed',
      timestamp: '2026-09-03T12:00:00Z',
      data: {
        transactionId: '11111111-1111-1111-1111-111111111111',
        transactionCode: 'TXN-2026-000101',
        fraudProbability: 0.972,
        riskLevel: 'CRITICAL',
        isFraud: true,
        threshold: 0.80,
        alertCreated: true,
        predictionId: 'pred-1',
        requestId: 'req-1',
        modelName: 'LightGBM_Fraud_Classifier',
        modelVersion: '1.0',
        anomalyReason: 'High risk anomaly',
        predictedAt: '2026-09-03T12:00:00Z'
      }
    };

    service.predictTransaction('11111111-1111-1111-1111-111111111111').subscribe(res => {
      expect(res.data.riskLevel).toBe('CRITICAL');
      expect(res.data.isFraud).toBeTrue();
      expect(res.data.modelName).toBe('LightGBM_Fraud_Classifier');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/fraud/predict`);
    expect(req.request.method).toBe('POST');
    req.flush(mockPredictionResult);
  });
});
