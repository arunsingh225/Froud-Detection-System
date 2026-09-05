export interface InvestigationReport {
  id: string;
  entityId: string;
  entityName: string;
  title: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  generatedBy: string;
  isAiGenerated: boolean;
  date: string;
  time: string;
  status: 'Draft' | 'Published' | 'Under Review' | 'Archived';
  category: 'SAR Report' | 'AML Audit Summary' | 'Account Takeover' | 'Velocity Anomaly';
  summary: string;
  findingsCount: number;
}
