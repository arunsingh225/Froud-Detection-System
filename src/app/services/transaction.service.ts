import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Transaction } from '../models/transaction.model';
import {
  ApiResponse,
  PagedResult,
  TransactionDto,
  CreateTransactionDto,
  FraudPredictionResultDto
} from '../models/api-response.model';

export function mapDtoToTransaction(dto: TransactionDto): Transaction {
  return {
    id: dto.transactionCode || dto.transactionId || '',
    transactionId: dto.transactionId || (dto as any).id || '',
    transactionCode: dto.transactionCode || dto.transactionId || (dto as any).id || '',
    customerName: dto.customerName || 'Unknown Customer',
    customerId: dto.customerCode || dto.customerId,
    amountInr: dto.amountInr,
    amountUsd: dto.amountUsd || Math.round(dto.amountInr / 83.5),
    date: dto.formattedDate || new Date(dto.timestamp).toLocaleDateString(),
    time: dto.formattedTime || new Date(dto.timestamp).toLocaleTimeString(),
    timestamp: dto.timestamp,
    target: dto.merchantName || 'Direct Merchant Settlement',
    merchant: dto.merchantName || 'Direct Merchant Settlement',
    method: dto.paymentMethod,
    cardLast4: dto.cardLast4,
    mcc: dto.mcc || '6012 (Financial Services)',
    location: dto.location || `${dto.city || 'Mumbai'}, ${dto.country || 'India'}`,
    city: dto.city || 'Mumbai',
    distanceFromTypical: dto.distanceFromTypical || 'Local Area',
    device: dto.device || 'Authorized Terminal',
    ip: dto.ipAddress || '127.0.0.1',
    vpnDetected: dto.vpnDetected,
    probability: dto.probability,
    riskTier: (dto.riskTier as any) || 'Low',
    status: (dto.status as any) || 'Pending Review',
    anomalyReason: dto.anomalyReason || 'Transaction processed via risk assessment pipeline.',
    merchantCategory: (dto.merchantCategory as any) || 'Digital Goods'
  };
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly http = inject(HttpClient);

  // Reactive Signals
  transactions = signal<Transaction[]>([]);
  selectedTransaction = signal<Transaction | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  totalCount = signal<number>(0);

  constructor() {
    this.loadTransactions();
  }

  loadTransactions(
    search?: string,
    riskTier?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 50
  ): Observable<Transaction[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search && search.trim()) params = params.set('search', search.trim());
    if (riskTier && riskTier !== 'All') params = params.set('riskTier', riskTier);
    if (status && status !== 'All') params = params.set('status', status);

    return this.http.get<ApiResponse<PagedResult<TransactionDto>>>(`${environment.apiUrl}/transactions`, { params }).pipe(
      map(res => {
        if (res && res.success && res.data && res.data.items) {
          const mapped = res.data.items.map(mapDtoToTransaction);
          this.transactions.set(mapped);
          this.totalCount.set(res.data.totalCount);
          if (!this.selectedTransaction() && mapped.length > 0) {
            this.selectedTransaction.set(mapped[0]);
          }
          this.loading.set(false);
          return mapped;
        }
        this.loading.set(false);
        return [];
      }),
      catchError(err => {
        this.loading.set(false);
        this.error.set(err.message || 'Failed to load transactions');
        return of(this.transactions());
      })
    );
  }

  getTransactions(): Transaction[] {
    return this.transactions();
  }

  getTransactionById(id: string): Transaction | undefined {
    // Check in-memory signal cache first
    const cleanId = id.toLowerCase();
    const cached = this.transactions().find(
      t => t.id.toLowerCase() === cleanId ||
           t.transactionCode?.toLowerCase() === cleanId ||
           t.transactionId?.toLowerCase() === cleanId
    );
    if (cached) {
      this.selectedTransaction.set(cached);
      return cached;
    }

    // Fetch from backend asynchronously
    this.http.get<ApiResponse<TransactionDto>>(`${environment.apiUrl}/transactions/${id}`).subscribe({
      next: res => {
        if (res.success && res.data) {
          const mapped = mapDtoToTransaction(res.data);
          this.selectedTransaction.set(mapped);
          this.transactions.update(prev => [mapped, ...prev.filter(t => t.id !== mapped.id)]);
        }
      },
      error: err => console.error('[TransactionService] Failed to load transaction by ID:', err)
    });

    return cached;
  }

  selectTransaction(txn: Transaction): void {
    this.selectedTransaction.set(txn);
  }

  createTransaction(dto: CreateTransactionDto): Observable<ApiResponse<TransactionDto>> {
    return this.http.post<ApiResponse<TransactionDto>>(`${environment.apiUrl}/transactions`, dto).pipe(
      tap(res => {
        if (res.success && res.data) {
          const mapped = mapDtoToTransaction(res.data);
          this.transactions.update(txns => [mapped, ...txns]);
          this.selectedTransaction.set(mapped);
          this.totalCount.update(c => c + 1);
        }
      })
    );
  }

  updateStatus(id: string, newStatus: Transaction['status']): Observable<ApiResponse<TransactionDto>> {
    return this.http.patch<ApiResponse<TransactionDto>>(`${environment.apiUrl}/transactions/${id}/status`, { status: newStatus }).pipe(
      tap(() => {
        this.transactions.update(txns =>
          txns.map(t => (t.id.toLowerCase() === id.toLowerCase() ? { ...t, status: newStatus } : t))
        );
        const curr = this.selectedTransaction();
        if (curr && curr.id.toLowerCase() === id.toLowerCase()) {
          this.selectedTransaction.set({ ...curr, status: newStatus });
        }
      })
    );
  }

  predictTransaction(transactionId: string): Observable<ApiResponse<FraudPredictionResultDto>> {
    return this.http.post<ApiResponse<FraudPredictionResultDto>>(`${environment.apiUrl}/fraud/predict`, {
      transactionId
    });
  }
}
