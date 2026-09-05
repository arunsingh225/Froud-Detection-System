import { RiskTier } from './types.model';

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
  riskTier: RiskTier;
  status: 'Pending Review' | 'Investigating' | 'Escalated' | 'Resolved' | 'Frozen' | 'Approved' | 'Rejected';
  anomalyReason: string;
  merchantCategory: 'Digital Goods' | 'Travel & Airline' | 'Electronics' | 'Grocery' | 'Crypto' | 'Luxury' | 'Finance';
}
