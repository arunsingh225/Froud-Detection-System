import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Customer } from '../models/customer.model';
import {
  ApiResponse,
  PagedResult,
  CustomerDto,
  CustomerDetailDto,
  TransactionDto,
  FraudAlertDto
} from '../models/api-response.model';

export function mapDtoToCustomer(dto: CustomerDto): Customer {
  return {
    id: dto.customerCode || dto.customerId,
    name: dto.fullName,
    email: dto.email,
    phone: dto.phone || '+91-98200-11223',
    initials: dto.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CU',
    customerSince: dto.createdAt ? new Date(dto.createdAt).getFullYear().toString() : '2024',
    accountAge: 'Active Member',
    riskScore: dto.riskScore,
    riskTier: (dto.riskTier as any) || 'Low',
    status: (dto.status as any) || 'Active',
    vol30d: dto.vol30d || 0,
    lastActive: 'Recently Active',
    avgTxn: dto.avgTxn || 0,
    knownDevicesCount: dto.knownDevicesCount || 1,
    priorFlags: dto.priorFlags || 0,
    residence: dto.residence || `${dto.city || 'Mumbai'}, ${dto.country || 'India'}`,
    city: dto.city || 'Mumbai',
    kycStatus: (dto.kycStatus as any) || 'Verified'
  };
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly http = inject(HttpClient);

  // Reactive Signals
  customers = signal<Customer[]>([]);
  selectedCustomer = signal<Customer | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  totalCount = signal<number>(0);

  constructor() {
    this.loadCustomers();
  }

  loadCustomers(
    search?: string,
    riskTier?: string,
    page: number = 1,
    pageSize: number = 50
  ): Observable<Customer[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search && search.trim()) params = params.set('search', search.trim());
    if (riskTier && riskTier !== 'All') params = params.set('riskTier', riskTier);

    return this.http.get<ApiResponse<PagedResult<CustomerDto>>>(`${environment.apiUrl}/customers`, { params }).pipe(
      map(res => {
        if (res && res.success && res.data && res.data.items) {
          const mapped = res.data.items.map(mapDtoToCustomer);
          this.customers.set(mapped);
          this.totalCount.set(res.data.totalCount);
          if (!this.selectedCustomer() && mapped.length > 0) {
            this.selectedCustomer.set(mapped[0]);
          }
          this.loading.set(false);
          return mapped;
        }
        this.loading.set(false);
        return [];
      }),
      catchError(err => {
        this.loading.set(false);
        this.error.set(err.message || 'Failed to load customers');
        return of(this.customers());
      })
    );
  }

  getCustomers(): Customer[] {
    return this.customers();
  }

  selectCustomer(cust: Customer): void {
    this.selectedCustomer.set(cust);
  }

  getCustomerById(id: string): Customer | undefined {
    const cached = this.customers().find(
      c => c.id.toLowerCase() === id.toLowerCase() || (c as any).customerId === id
    );
    if (cached) {
      this.selectedCustomer.set(cached);
      return cached;
    }

    this.http.get<ApiResponse<CustomerDetailDto>>(`${environment.apiUrl}/customers/${id}`).subscribe({
      next: res => {
        if (res.success && res.data) {
          const mapped = mapDtoToCustomer(res.data);
          this.selectedCustomer.set(mapped);
          this.customers.update(prev => [mapped, ...prev.filter(c => c.id !== mapped.id)]);
        }
      },
      error: err => console.error('[CustomerService] Failed to load customer by ID:', err)
    });

    return cached;
  }

  getCustomerDetail(id: string): Observable<ApiResponse<CustomerDetailDto>> {
    return this.http.get<ApiResponse<CustomerDetailDto>>(`${environment.apiUrl}/customers/${id}`);
  }

  getCustomerTransactions(id: string): Observable<ApiResponse<TransactionDto[]>> {
    return this.http.get<ApiResponse<TransactionDto[]>>(`${environment.apiUrl}/customers/${id}/transactions`);
  }

  getCustomerAlerts(id: string): Observable<ApiResponse<FraudAlertDto[]>> {
    return this.http.get<ApiResponse<FraudAlertDto[]>>(`${environment.apiUrl}/customers/${id}/alerts`);
  }
}
