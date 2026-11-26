import { RiskTier, AlertStatus } from './types.model';

/** The analyst's verdict when an alert is resolved: the ground truth for measuring the model. */
export type AlertOutcome = 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE';

export interface FraudAlert {
  /** Display code, for example ALT-2026-0891. The API addresses alerts by `alertGuid`. */
  id: string;
  alertGuid?: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  amountInr: number;
  fraudProbability: number;
  riskTier: RiskTier;
  reason: string;
  status: AlertStatus;
  outcome?: AlertOutcome | null;
  assignedTo?: string;
  createdAt: string;
  createdTime: string;
  location: string;
  alertType: string;
}
