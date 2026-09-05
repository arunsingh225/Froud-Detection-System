import { RiskTier, InvestigationStatus, InvestigationPriority } from './types.model';

export interface Investigation {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  riskTier: RiskTier;
  fraudProbability: number;
  priority: InvestigationPriority;
  assignedInvestigator: string;
  status: InvestigationStatus;
  createdDate: string;
  lastUpdated: string;
  amountInr: number;
  location: string;
  alertReason: string;
}

export interface EvidenceItem {
  type: string;
  finding: string;
  confidence: number;
  source: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface EvidenceCategory {
  category: 'Transaction' | 'Behavioral' | 'Device' | 'Location' | 'ML' | 'Policy';
  icon: string;
  items: EvidenceItem[];
}

export interface TimelineStep {
  id: string;
  label: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'active' | 'pending';
  actor: 'system' | 'ai' | 'human';
}
