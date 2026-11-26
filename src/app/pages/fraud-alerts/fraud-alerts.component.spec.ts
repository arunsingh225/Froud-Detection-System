import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FraudAlertsComponent } from './fraud-alerts.component';
import { FraudAlertService } from '../../services/fraud-alert.service';
import { TransactionService } from '../../services/transaction.service';
import { FraudAlert } from '../../models/alert.model';

describe('FraudAlertsComponent: resolving with a verdict', () => {
  const alert = (over: Partial<FraudAlert> = {}): FraudAlert => ({
    id: 'ALT-1', alertGuid: 'guid-1', transactionId: 'TXN-1', customerId: 'c1', customerName: 'Arjun Mehta', amountInr: 1000,
    fraudProbability: 85, riskTier: 'High', reason: 'r', status: 'Open', createdAt: 'Nov 26, 2026', createdTime: '10:00 IST',
    location: 'Pune, India', alertType: 'Velocity', ...over
  });

  let resolve: jasmine.Spy;
  let fixture: ComponentFixture<FraudAlertsComponent>;
  const alerts = signal<FraudAlert[]>([]);

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const openDialog = () => {
    (Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Mark Resolved')) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    resolve = jasmine.createSpy('resolveAlert').and.returnValue(of({ success: true }));
    alerts.set([alert(), alert({ id: 'ALT-2', alertGuid: 'guid-2', status: 'Resolved', outcome: 'CONFIRMED_FRAUD' })]);
    TestBed.configureTestingModule({
      imports: [FraudAlertsComponent],
      providers: [
        provideRouter([]),
        {
          provide: FraudAlertService,
          useValue: { loadAlerts: () => of([]), getAlerts: () => alerts(), alerts, loading: signal(false), error: signal<string | null>(null), resolveAlert: resolve }
        },
        { provide: TransactionService, useValue: { getTransactionById: () => undefined, selectTransaction: () => undefined } }
      ]
    });
    fixture = TestBed.createComponent(FraudAlertsComponent);
    fixture.detectChanges();
  });

  it('asks for the verdict instead of resolving at once, and the save button waits for a choice', () => {
    openDialog();
    expect(q('resolve-dialog')).not.toBeNull();
    expect(resolve).not.toHaveBeenCalled();
    expect((q('resolve-save') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('sends the chosen verdict and the note, then closes', () => {
    openDialog();
    q('outcome-false-positive')!.click();
    fixture.componentInstance.notes = 'Customer confirmed by phone';
    fixture.detectChanges();
    (q('resolve-save') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(resolve).toHaveBeenCalledOnceWith('ALT-1', 'FALSE_POSITIVE', 'Customer confirmed by phone');
    expect(q('resolve-dialog')).toBeNull();
  });

  it('keeps the dialog open and shows the reason when saving fails', () => {
    resolve.and.returnValue(throwError(() => new Error('Say whether the alert was confirmed fraud or a false positive.')));
    openDialog();
    q('outcome-fraud')!.click();
    fixture.detectChanges();
    (q('resolve-save') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(q('resolve-dialog')).not.toBeNull();
    expect(el().textContent).toContain('Say whether the alert was confirmed fraud');
    expect((q('resolve-save') as HTMLButtonElement).disabled).toBeFalse();   // can try again
  });

  it('cancel closes the dialog without calling the API', () => {
    openDialog();
    fixture.componentInstance.closeResolve();
    fixture.detectChanges();
    expect(q('resolve-dialog')).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('shows the stored verdict on resolved alerts and no Mark Resolved button on them', () => {
    expect(q('alert-outcome')!.textContent).toContain('Confirmed fraud');
    expect(Array.from(el().querySelectorAll('button')).filter(b => b.textContent?.includes('Mark Resolved')).length).toBe(1);
  });
});
