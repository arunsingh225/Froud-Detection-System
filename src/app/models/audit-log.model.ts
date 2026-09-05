export interface AuditLogItem {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  actor: {
    name: string;
    type: 'AI AGENT' | 'INVESTIGATOR' | 'SERVICE' | 'ADMIN' | 'EXTERNAL';
    avatar?: string;
    icon?: string;
  };
  action: string;
  subAction?: string;
  resource: string;
  result: 'SUCCESS' | 'PENDING' | 'FAILED';
  category: 'Authentication' | 'Investigation' | 'Policy Change' | 'Data Export' | 'Rule Modification';
}
