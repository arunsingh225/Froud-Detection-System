export interface InvestigateRequest {
  transactionId: string;
  alertId?: string;
}

export interface EvidenceItem {
  id: string;
  category: string;
  findingType: string;
  findingDetail: string;
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source: string;
}

export interface SuspiciousFinding {
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  evidenceIds: string[];
}

export interface PolicyCitation {
  document: string;
  section: string;
  chunkId: string;
  source: string;
  excerpt: string;
}

export interface InvestigationTimelineStep {
  timelineId: string;
  stepNumber: number;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
  actorType: 'system' | 'ai' | 'human';
  actorName: string;
  stepTimestamp: string;
}

export interface InvestigationDetailFull {
  investigationId: string;
  investigationCode: string;
  transactionId: string;
  transactionCode: string;
  customerId: string;
  customerName: string;
  amountInr: number;
  riskTier: string;
  fraudProbability: number;
  status: string;
  priority: string;
  resolutionDecision?: string;
  resolutionNotes?: string;
  summary: string;
  recommendedAction: string;
  confidence: number;
  evidence: EvidenceItem[];
  findings: SuspiciousFinding[];
  policyReferences: PolicyCitation[];
  timeline: InvestigationTimelineStep[];
  createdAt: string;
  updatedAt: string;
}
