import { RiskTier, AlertStatus } from './types.model';

export interface FraudAlert {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  amountInr: number;
  fraudProbability: number;
  riskTier: RiskTier;
  reason: string;
  status: AlertStatus;
  assignedTo?: string;
  createdAt: string;
  createdTime: string;
  location: string;
  alertType: string;
}
