export interface AdvancedDashboardKpis {
  totalTransactions: number;
  totalTransactionValueInr: number;
  totalTransactionValueUsd: number;
  averageTransactionValueInr: number;
  fraudFlaggedCount: number;
  fraudRatePercentage: number;
  highRiskCount: number;
  criticalRiskCount: number;
  totalAlertsCount: number;
  openAlertsCount: number;
  resolvedAlertsCount: number;
  criticalAlertsCount: number;
  activeInvestigationsCount: number;
  completedInvestigationsCount: number;
  averageInvestigationHours: number;
  estimatedFraudExposureInr: number;
  preventedFraudLossInr: number;
  preventedLossStatus: string;
  threatBreakdown: {
    accountTakeoverCount: number;
    velocitySpikesCount: number;
    syntheticIdentityCount: number;
    cardTestingCount: number;
  };
}

export interface FraudTrendPoint {
  date: string;
  transactions: number;
  flagged: number;
  fraudRate: number;
}

export interface FraudTrendResponse {
  period: string;
  points: FraudTrendPoint[];
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
}

export interface CategoryRiskItem {
  category: string;
  transactionCount: number;
  flaggedCount: number;
  totalVolumeInr: number;
  fraudRate: number;
  riskTier: string;
}

export interface GeographicRiskItem {
  location: string;
  country: string;
  city: string;
  transactions: number;
  flagged: number;
  fraudRate: number;
  riskLevel: string;
}

export interface MerchantRiskItem {
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  category: string;
  mcc: string;
  transactionCount: number;
  totalVolumeInr: number;
  flaggedTransactions: number;
  fraudRate: number;
  averageTransactionInr: number;
  riskLevel: string;
}

export interface CustomerRiskItem {
  customerId: string;
  customerCode: string;
  customerName: string;
  transactionCount: number;
  totalVolumeInr: number;
  previousAlertsCount: number;
  previousInvestigationsCount: number;
  currentRiskScore: number;
  currentRiskTier: string;
}

export interface DeviceRiskItem {
  deviceType: string;
  operatingSystem: string;
  browser: string;
  totalTransactions: number;
  flaggedTransactions: number;
  vpnDetectedCount: number;
  fraudRate: number;
  riskTier: string;
}

export interface AlertAnalytics {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  averageResolutionHours: number;
}

export interface InvestigationAnalytics {
  totalInvestigations: number;
  openInvestigations: number;
  completedInvestigations: number;
  escalatedInvestigations: number;
  averageInvestigationHours: number;
  aiAssistedCount: number;
  aiAssistedPercentage: number;
  decisionDistribution: Record<string, number>;
}

export interface ProbabilityHistogramBucket {
  rangeLabel: string;
  minProb: number;
  maxProb: number;
  count: number;
  percentage: number;
}

export interface ModelMonitoringData {
  modelName: string;
  modelVersion: string;
  featureCount: number;
  rocAuc: number;
  prAuc: number;
  operationalThreshold: number;
  predictionsProcessed: number;
  flaggedPredictions: number;
  averageFraudProbability: number;
  highRiskPercentage: number;
  criticalPercentage: number;
  averageInferenceLatencyMs: number;
  probabilityDistribution: ProbabilityHistogramBucket[];
  driftStatus: string;
  driftExplanation: string;
}

export interface LiveAlertItem {
  alertId: string;
  alertCode: string;
  transactionCode: string;
  transactionId: string;
  customerName: string;
  amountInr: number;
  severity: string;
  fraudProbability: number;
  status: string;
  reason: string;
  createdAt: string;
}

export interface ComponentHealthItem {
  component: string;
  status: string;
  latency: string;
  details: string;
}

export interface OperationalHealthStatus {
  overallStatus: string;
  components: ComponentHealthItem[];
  checkedAt: string;
}
