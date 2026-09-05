import { RiskTier } from './types.model';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  initials?: string;
  customerSince: string;
  accountAge: string;
  riskScore: number;
  riskTier: RiskTier;
  status: 'Active' | 'Under Review' | 'Suspended';
  vol30d: number;
  lastActive: string;
  avgTxn: number;
  knownDevicesCount: number;
  priorFlags: number;
  residence: string;
  city: string;
  pan?: string;
  aadhaar?: string;
  kycStatus: 'Verified' | 'Pending' | 'Failed';
}
