using System;
using System.Collections.Generic;

namespace FraudGuard.Api.DTOs.Analytics
{
    public class AdvancedDashboardKpisDto
    {
        // Transaction Volume
        public int TotalTransactions { get; set; }
        public decimal TotalTransactionValueInr { get; set; }
        public decimal TotalTransactionValueUsd { get; set; }
        public decimal AverageTransactionValueInr { get; set; }

        // Fraud Metrics
        public int FraudFlaggedCount { get; set; }
        public decimal FraudRatePercentage { get; set; }
        public int HighRiskCount { get; set; }
        public int CriticalRiskCount { get; set; }

        // Alerts Metrics
        public int TotalAlertsCount { get; set; }
        public int OpenAlertsCount { get; set; }
        public int ResolvedAlertsCount { get; set; }
        public int CriticalAlertsCount { get; set; }

        // Investigations Metrics
        public int ActiveInvestigationsCount { get; set; }
        public int CompletedInvestigationsCount { get; set; }
        public decimal AverageInvestigationHours { get; set; }

        // Financial Exposure & Prevented Loss
        public decimal EstimatedFraudExposureInr { get; set; }
        public decimal PreventedFraudLossInr { get; set; }
        public string PreventedLossStatus { get; set; } = "Calculated from transactions in review/intervention";

        // Threat Typology Breakdown
        public ThreatBreakdownDto ThreatBreakdown { get; set; } = new();
    }

    public class FraudTrendPointDto
    {
        public string Date { get; set; } = string.Empty;
        public int Transactions { get; set; }
        public int Flagged { get; set; }
        public decimal FraudRate { get; set; }
    }

    public class FraudTrendResponseDto
    {
        public string Period { get; set; } = "7d"; // 24h, 7d, 30d, 90d
        public List<FraudTrendPointDto> Points { get; set; } = new();
    }

    public class RiskDistributionDto
    {
        public int Low { get; set; }
        public int Medium { get; set; }
        public int High { get; set; }
        public int Critical { get; set; }
        public int Total { get; set; }
    }

    public class CategoryRiskDto
    {
        public string Category { get; set; } = string.Empty;
        public int TransactionCount { get; set; }
        public int FlaggedCount { get; set; }
        public decimal TotalVolumeInr { get; set; }
        public decimal FraudRate { get; set; }
        public string RiskTier { get; set; } = "Low";
    }

    public class GeographicRiskDto
    {
        public string Location { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public int Transactions { get; set; }
        public int Flagged { get; set; }
        public decimal FraudRate { get; set; }
        public string RiskLevel { get; set; } = "LOW";
    }

    public class MerchantRiskDto
    {
        public Guid MerchantId { get; set; }
        public string MerchantCode { get; set; } = string.Empty;
        public string MerchantName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Mcc { get; set; } = string.Empty;
        public int TransactionCount { get; set; }
        public decimal TotalVolumeInr { get; set; }
        public int FlaggedTransactions { get; set; }
        public decimal FraudRate { get; set; }
        public decimal AverageTransactionInr { get; set; }
        public string RiskLevel { get; set; } = "Low";
    }

    public class CustomerRiskDto
    {
        public Guid CustomerId { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public int TransactionCount { get; set; }
        public decimal TotalVolumeInr { get; set; }
        public int PreviousAlertsCount { get; set; }
        public int PreviousInvestigationsCount { get; set; }
        public decimal CurrentRiskScore { get; set; }
        public string CurrentRiskTier { get; set; } = "Low";
    }

    public class DeviceRiskDto
    {
        public string DeviceType { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public int TotalTransactions { get; set; }
        public int FlaggedTransactions { get; set; }
        public int VpnDetectedCount { get; set; }
        public decimal FraudRate { get; set; }
        public string RiskTier { get; set; } = "Low";
    }

    public class AlertAnalyticsDto
    {
        public int Total { get; set; }
        public int Open { get; set; }
        public int Investigating { get; set; }
        public int Resolved { get; set; }
        public int Critical { get; set; }
        public int High { get; set; }
        public int Medium { get; set; }
        public int Low { get; set; }
        public decimal AverageResolutionHours { get; set; }
    }

    public class InvestigationAnalyticsDto
    {
        public int TotalInvestigations { get; set; }
        public int OpenInvestigations { get; set; }
        public int CompletedInvestigations { get; set; }
        public int EscalatedInvestigations { get; set; }
        public decimal AverageInvestigationHours { get; set; }
        public int AiAssistedCount { get; set; }
        public decimal AiAssistedPercentage { get; set; }
        public Dictionary<string, int> DecisionDistribution { get; set; } = new();
    }

    public class ProbabilityHistogramBucketDto
    {
        public string RangeLabel { get; set; } = string.Empty; // 0.00-0.20, etc.
        public decimal MinProb { get; set; }
        public decimal MaxProb { get; set; }
        public int Count { get; set; }
        public decimal Percentage { get; set; }
    }

    public class ModelMonitoringDto
    {
        // Training Specifications
        public string ModelName { get; set; } = "LightGBM_Fraud_Classifier";
        public string ModelVersion { get; set; } = "3.1.2";
        public int FeatureCount { get; set; } = 464;
        public decimal RocAuc { get; set; } = 0.9168m;
        public decimal PrAuc { get; set; } = 0.5393m;
        public decimal OperationalThreshold { get; set; } = 0.80m;

        // Runtime Operational Metrics (From Real Predictions)
        public int PredictionsProcessed { get; set; }
        public int FlaggedPredictions { get; set; }
        public decimal AverageFraudProbability { get; set; }
        public decimal HighRiskPercentage { get; set; }
        public decimal CriticalPercentage { get; set; }
        public int AverageInferenceLatencyMs { get; set; }

        // Probability Histogram
        public List<ProbabilityHistogramBucketDto> ProbabilityDistribution { get; set; } = new();

        // Model Drift Telemetry
        public string DriftStatus { get; set; } = "STABLE";
        public string DriftExplanation { get; set; } = "Observed transaction amount and feature distributions align within training baseline boundaries.";
    }

    public class LiveAlertDto
    {
        public Guid AlertId { get; set; }
        public string AlertCode { get; set; } = string.Empty;
        public string TransactionCode { get; set; } = string.Empty;
        public Guid TransactionId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal AmountInr { get; set; }
        public string Severity { get; set; } = "High";
        public decimal FraudProbability { get; set; }
        public string Status { get; set; } = "New";
        public string Reason { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class ComponentHealthItemDto
    {
        public string Component { get; set; } = string.Empty;
        public string Status { get; set; } = "HEALTHY"; // HEALTHY, DEGRADED, OFFLINE
        public string Latency { get; set; } = "2ms";
        public string Details { get; set; } = string.Empty;
    }

    public class OperationalHealthDto
    {
        public string OverallStatus { get; set; } = "HEALTHY";
        public List<ComponentHealthItemDto> Components { get; set; } = new();
        public DateTimeOffset CheckedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
