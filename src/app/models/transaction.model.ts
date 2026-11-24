import { RiskTier } from './types.model';
import { FactorContribution } from './api-response.model';

export interface Transaction {
  id: string;
  transactionId: string;
  transactionCode: string;
  customerName: string;
  customerId: string;
  amountInr: number;
  amountUsd?: number;
  date: string;
  time: string;
  timestamp: string;
  target: string;
  merchant: string;
  method: string;
  cardLast4?: string;
  mcc?: string;
  location: string;
  city?: string;
  distanceFromTypical?: string;
  device: string;
  ip: string;
  vpnDetected: boolean;
  probability: number;
  /** Calibrated probability (0-1) stored with the prediction, when loaded from the detail endpoint. */
  calibratedProbability?: number | null;
  /** Top feature attributions stored with the prediction, when loaded from the detail endpoint. */
  topFactors?: FactorContribution[] | null;
  riskTier: RiskTier;
  status: 'Pending Review' | 'Investigating' | 'Escalated' | 'Resolved' | 'Frozen' | 'Approved' | 'Rejected';
  anomalyReason: string;
  merchantCategory: 'Digital Goods' | 'Travel & Airline' | 'Electronics' | 'Grocery' | 'Crypto' | 'Luxury' | 'Finance';
}
