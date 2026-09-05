export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
  timestamp: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Transaction Backend DTO
export interface TransactionDto {
  transactionId: string;
  transactionCode: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  amountInr: number;
  amountUsd?: number;
  paymentMethod: string;
  cardLast4?: string;
  merchantName: string;
  merchantCategory: string;
  mcc?: string;
  location: string;
  city?: string;
  country?: string;
  distanceFromTypical?: string;
  device: string;
  ipAddress: string;
  vpnDetected: boolean;
  probability: number;
  riskTier: string;
  status: string;
  anomalyReason: string;
  formattedDate: string;
  formattedTime: string;
  timestamp: string;
}

export interface CreateTransactionDto {
  accountId: string;
  customerId: string;
  amountInr: number;
  amountUsd?: number;
  paymentMethod: string;
  cardLast4?: string;
  ipAddress: string;
  city: string;
  country: string;
  distanceFromTypicalKm?: number;
  vpnOrProxyDetected: boolean;
  merchantId?: string;
  deviceId?: string;
}

// Fraud Prediction DTO
export interface FraudPredictionResultDto {
  transactionId: string;
  transactionCode: string;
  fraudProbability: number;
  riskLevel: string;
  isFraud: boolean;
  threshold: number;
  alertCreated: boolean;
  alertId?: string;
  alertCode?: string;
  predictionId: string;
  requestId: string;
  modelName: string;
  modelVersion: string;
  anomalyReason: string;
  predictedAt: string;
}

export interface EngineHealthDto {
  aspNetCore: string;
  fastApi: string;
  modelLoaded: boolean;
  checkedAt: string;
  message: string;
}

export interface FraudModelInfoDto {
  modelName: string;
  modelVersion: string;
  rocAuc: number;
  prAuc: number;
  threshold: number;
  featureCount: number;
  trainingDate: string;
}

// Fraud Alert Backend DTO
export interface FraudAlertDto {
  alertId: string;
  alertCode: string;
  transactionId: string;
  transactionCode: string;
  customerId: string;
  customerName: string;
  amountInr: number;
  fraudProbability: number;
  riskTier: string;
  severity: string;
  reason: string;
  status: string;
  assignedTo?: string;
  location: string;
  alertType: string;
  createdAt: string;
  createdDateFormatted: string;
  createdTimeFormatted: string;
}

// Customer Backend DTO
export interface CustomerDto {
  customerId: string;
  customerCode: string;
  fullName: string;
  email: string;
  phone?: string;
  riskScore: number;
  riskTier: string;
  status: string;
  kycStatus: string;
  city: string;
  country: string;
  residence: string;
  vol30d: number;
  avgTxn: number;
  knownDevicesCount: number;
  priorFlags: number;
  createdAt: string;
}

export interface CustomerDetailDto extends CustomerDto {
  accounts: AccountSummaryDto[];
  recentTransactions: TransactionDto[];
  activeAlerts: FraudAlertDto[];
}

export interface AccountSummaryDto {
  accountId: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  balance: number;
  status: string;
}

// Investigation Backend DTO
export interface InvestigationDto {
  investigationId: string;
  investigationCode: string;
  alertId?: string;
  alertCode?: string;
  customerId: string;
  customerName: string;
  transactionId: string;
  transactionCode: string;
  amountInr: number;
  fraudProbability: number;
  riskTier: string;
  priority: string;
  assignedInvestigator: string;
  status: string;
  alertReason: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationDetailDto extends InvestigationDto {
  evidence: EvidenceItemDto[];
  timeline: TimelineStepDto[];
}

export interface EvidenceItemDto {
  evidenceId: string;
  category: string;
  finding: string;
  confidence: number;
  source: string;
  severity: string;
  createdAt: string;
}

export interface TimelineStepDto {
  timelineId: string;
  title: string;
  description: string;
  status: string;
  actorType: string;
  eventTimestamp: string;
}

// Report Backend DTO
export interface ReportDto {
  reportId: string;
  reportCode: string;
  title: string;
  category: string;
  riskLevel: string;
  status: string;
  generatedBy: string;
  summary: string;
  findingsCount: number;
  createdAt: string;
  entityId?: string;
  entityName?: string;
}

export interface CreateReportDto {
  customerId?: string;
  transactionId?: string;
  reportTitle: string;
  category: string;
  riskLevel: string;
  summary: string;
}

// Audit Log Backend DTO
export interface AuditLogDto {
  auditLogId: number;
  auditCode: string;
  timestamp: string;
  date: string;
  time: string;
  actorName: string;
  actorType: string;
  action: string;
  subAction?: string;
  resourceTarget: string;
  result: string;
  category: string;
  detailsJson?: string;
}

// Analytics Backend DTOs
export interface DashboardKpisDto {
  totalMonitoredVolumeInr: number;
  totalMonitoredVolumeUsd: number;
  flaggedTransactionsCount: number;
  activeInvestigationsCount: number;
  preventedFraudLossInr: number;
  preventedFraudLossUsd: number;
  aiAssistedPercentage: number;
  threatBreakdown: {
    accountTakeoverCount: number;
    velocitySpikesCount: number;
    syntheticIdentityCount: number;
    cardTestingCount: number;
  };
}

export interface RiskTrendPointDto {
  dateLabel: string;
  anomalyRate: number;
  baselineRate: number;
}

export interface MccRiskItemDto {
  mccCode: string;
  categoryName: string;
  riskIndex: number;
  transactionCount: number;
  severity: string;
}

export interface ModelTelemetryDto {
  precision: number;
  recall: number;
  latencyMs: number;
  falsePositiveRate: number;
  modelVersion: string;
  hardwareCluster: string;
}

export interface SearchResultDto {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  route: string;
  status?: string;
  riskLevel?: string;
}
