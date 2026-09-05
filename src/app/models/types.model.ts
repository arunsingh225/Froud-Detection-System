export type ScreenId =
  | 'login'
  | 'dashboard'
  | 'transactions'
  | 'transaction_detail'
  | 'fraud_alerts'
  | 'investigations'
  | 'investigation_detail'
  | 'ai_investigator'
  | 'customers'
  | 'customer_detail'
  | 'risk_analytics'
  | 'reports'
  | 'audit_logs'
  | 'settings';

export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low';
export type UserRole = 'ADMIN' | 'INVESTIGATOR' | 'COMPLIANCE' | 'ANALYST' | 'VIEWER';
export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type AlertStatus = 'Open' | 'Investigating' | 'Escalated' | 'Resolved';
export type InvestigationStatus = 'New' | 'Investigating' | 'Pending Review' | 'Escalated' | 'Resolved' | 'Approved' | 'Rejected';
export type InvestigationPriority = 'Critical' | 'High' | 'Medium' | 'Low';
