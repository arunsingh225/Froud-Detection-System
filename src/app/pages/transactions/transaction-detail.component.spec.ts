import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError, NEVER } from 'rxjs';
import { TransactionDetailComponent } from './transaction-detail.component';
import { TransactionService } from '../../services/transaction.service';
import { ModalService } from '../../services/modal.service';
import { AuthService } from '../../services/auth.service';
import { Transaction } from '../../models/transaction.model';
import { FraudPredictionResultDto } from '../../models/api-response.model';
import { buildScoreExplanation } from '../../shared/utils/score-explanation';

const GUID = '11111111-1111-1111-1111-111111111111';

const txn = {
  id: 'TXN-2026-000101', transactionId: GUID, transactionCode: 'TXN-2026-000101',
  customerName: 'Arjun Mehta', customerId: 'CUS-001', amountInr: 850000, probability: 97.2,
  riskTier: 'Critical', status: 'Investigating', anomalyReason: 'Velocity spike'
} as unknown as Transaction;

const result = (over: Partial<FraudPredictionResultDto> = {}): FraudPredictionResultDto => ({
  transactionId: GUID, transactionCode: 'TXN-2026-000101', fraudProbability: 0.93, riskLevel: 'CRITICAL',
  isFraud: true, threshold: 0.8, alertCreated: false, predictionId: 'p', requestId: 'r', modelName: 'm',
  modelVersion: '1', anomalyReason: '', predictedAt: '2026-11-23T10:00:00Z',
  calibratedProbability: 0.412,
  topFactors: [
    { feature: 'TransactionAmt', value: 4999, contribution: 1.25 },
    { feature: 'P_emaildomain', value: 55, contribution: -0.5 },
    { feature: 'C13', value: null, contribution: 0.25 }
  ],
  ...over
});

describe('buildScoreExplanation', () => {
  it('converts probabilities to percentages and keeps the calibrated one separate from the model score', () => {
    const ex = buildScoreExplanation(result());
    expect(ex.modelScorePct).toBeCloseTo(93, 6);
    expect(ex.calibratedPct).toBeCloseTo(41.2, 6);
  });

  it('reports a missing calibrated probability as null (never as 0)', () => {
    expect(buildScoreExplanation(result({ calibratedProbability: null })).calibratedPct).toBeNull();
    expect(buildScoreExplanation(result({ calibratedProbability: undefined })).calibratedPct).toBeNull();
    expect(buildScoreExplanation(result({ calibratedProbability: 0 })).calibratedPct).toBe(0);
  });

  it('sets direction, readable labels, value text and bar widths relative to the largest contribution', () => {
    const f = buildScoreExplanation(result()).factors;
    expect(f.map(x => x.direction)).toEqual(['up', 'down', 'up']);
    expect(f.map(x => x.widthPct)).toEqual([100, 40, 20]);
    expect(f[0].label).toBe('TransactionAmt');
    expect(f[1].label).toBe('P emaildomain');
    expect(f[0].valueText).toBe('4,999');
    expect(f[2].valueText).toBe('missing');
  });

  it('copes with no factors at all', () => {
    expect(buildScoreExplanation(result({ topFactors: null })).factors).toEqual([]);
    expect(buildScoreExplanation(result({ topFactors: [{ feature: 'x', value: 1, contribution: 0 }] })).factors[0].widthPct).toBe(0);
  });
});

describe('TransactionDetailComponent: AI score explanation', () => {
  let predict: jasmine.Spy;

  function setup(role: string): ComponentFixture<TransactionDetailComponent> {
    predict = jasmine.createSpy('predictTransaction');
    TestBed.configureTestingModule({
      imports: [TransactionDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'TXN-2026-000101' } } } },
        {
          provide: TransactionService,
          useValue: {
            getTransactionById: () => txn, selectedTransaction: () => txn, transactions: () => [txn],
            predictTransaction: predict, selectTransaction: () => undefined, updateStatus: () => NEVER
          }
        },
        { provide: ModalService, useValue: { openSARModal: () => undefined } },
        { provide: AuthService, useValue: { hasAnyRole: (roles: string[]) => roles.includes(role) } }
      ]
    });
    const fixture = TestBed.createComponent(TransactionDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  const panel = (f: ComponentFixture<unknown>) =>
    (f.nativeElement as HTMLElement).querySelector('[data-testid="score-explanation"]') as HTMLElement;
  const rescoreButton = (f: ComponentFixture<unknown>) => panel(f).querySelector('button') as HTMLButtonElement | null;

  it('hides the re-score button from roles that may not call /fraud/predict', () => {
    const f = setup('COMPLIANCE');
    expect(rescoreButton(f)).toBeNull();
    expect(panel(f).textContent).toContain('available to investigators and administrators');
  });

  it('re-scores with the transaction GUID and shows calibrated probability, model score and factors', () => {
    const f = setup('INVESTIGATOR');
    predict.and.returnValue(of({ success: true, message: 'ok', timestamp: 't', data: result() }));

    rescoreButton(f)!.click();
    f.detectChanges();

    expect(predict).toHaveBeenCalledOnceWith(GUID);
    const el = panel(f);
    expect(el.querySelector('[data-testid="calibrated-pct"]')!.textContent).toContain('41.2%');
    expect(el.querySelector('[data-testid="model-score-pct"]')!.textContent).toContain('93.0%');
    const rows = el.querySelectorAll('[data-testid="factor-list"] > div');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('TransactionAmt');
    expect(rows[0].textContent).toContain('+1.25');
    expect(rows[1].textContent).toContain('-0.50');
    expect(rows[2].textContent).toContain('missing');
  });

  it('shows n/a (not 0%) when the engine returns no calibrated probability', () => {
    const f = setup('ADMIN');
    predict.and.returnValue(of({ success: true, message: 'ok', timestamp: 't', data: result({ calibratedProbability: null }) }));
    rescoreButton(f)!.click();
    f.detectChanges();
    expect(panel(f).querySelector('[data-testid="calibrated-pct"]')!.textContent).toContain('n/a');
  });

  it('shows the error message and stays usable when scoring fails', () => {
    const f = setup('INVESTIGATOR');
    predict.and.returnValue(throwError(() => new Error('Fraud detection engine is temporarily unavailable.')));
    rescoreButton(f)!.click();
    f.detectChanges();
    expect(panel(f).querySelector('[data-testid="explain-error"]')!.textContent).toContain('temporarily unavailable');
    expect(rescoreButton(f)!.disabled).toBeFalse();
  });

  it('disables the button while a score is in flight and ignores double clicks', () => {
    const f = setup('INVESTIGATOR');
    predict.and.returnValue(NEVER);
    const button = rescoreButton(f)!;
    button.click();
    f.detectChanges();
    expect(rescoreButton(f)!.disabled).toBeTrue();
    f.componentInstance.rescoreAndExplain();
    expect(predict).toHaveBeenCalledTimes(1);
  });
});
