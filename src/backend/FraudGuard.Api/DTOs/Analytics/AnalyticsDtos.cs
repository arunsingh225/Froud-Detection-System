using System.Collections.Generic;

namespace FraudGuard.Api.DTOs.Analytics
{
    public class DashboardKpisDto
    {
        public decimal TotalMonitoredVolumeInr { get; set; }
        public decimal TotalMonitoredVolumeUsd { get; set; }
        public int FlaggedTransactionsCount { get; set; }
        public int ActiveInvestigationsCount { get; set; }
        public decimal PreventedFraudLossInr { get; set; }
        public decimal PreventedFraudLossUsd { get; set; }
        public decimal AiAssistedPercentage { get; set; } = 89.0m;
        public ThreatBreakdownDto ThreatBreakdown { get; set; } = new ThreatBreakdownDto();
    }

    public class ThreatBreakdownDto
    {
        public int AccountTakeoverCount { get; set; }
        public int VelocitySpikesCount { get; set; }
        public int SyntheticIdentityCount { get; set; }
        public int CardTestingCount { get; set; }
    }

    public class RiskTrendPointDto
    {
        public string DateLabel { get; set; } = string.Empty;
        public decimal AnomalyRate { get; set; }
        public decimal BaselineRate { get; set; }
    }

    public class MccRiskItemDto
    {
        public string MccCode { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public decimal RiskIndex { get; set; }
        public int TransactionCount { get; set; }
        public string Severity { get; set; } = "Low";
    }

    public class ModelTelemetryDto
    {
        public decimal Precision { get; set; } = 0m;
        public decimal Recall { get; set; } = 0m;
        public int LatencyMs { get; set; } = 24;
        public decimal FalsePositiveRate { get; set; } = 0m;
        public string ModelName { get; set; } = "LightGBM_Fraud_Classifier";
        public string ModelVersion { get; set; } = "1.0";
        public string HardwareCluster { get; set; } = "Local CPU Inference";
        public decimal RocAuc { get; set; } = 0.9168m;
        public decimal PrAuc { get; set; } = 0.5393m;
        public decimal OperationalThreshold { get; set; } = 0.80m;
        public int FeatureCount { get; set; } = 464;
    }
}
