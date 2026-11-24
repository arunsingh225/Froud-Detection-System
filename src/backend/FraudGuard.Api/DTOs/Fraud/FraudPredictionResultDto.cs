using System;
using System.Collections.Generic;

namespace FraudGuard.Api.DTOs.Fraud
{
    /// <summary>
    /// Consolidated fraud prediction output returned by the ASP.NET Core orchestration service.
    /// </summary>
    public class FraudPredictionResultDto
    {
        public Guid TransactionId { get; set; }
        public string TransactionCode { get; set; } = string.Empty;
        public decimal FraudProbability { get; set; }
        public string RiskLevel { get; set; } = "LOW";
        public bool IsFraud { get; set; }
        public decimal Threshold { get; set; } = 0.80m;
        public bool AlertCreated { get; set; }
        public Guid? AlertId { get; set; }
        public string? AlertCode { get; set; }
        public Guid PredictionId { get; set; }
        public string RequestId { get; set; } = string.Empty;
        public string ModelName { get; set; } = string.Empty;
        public string ModelVersion { get; set; } = "1.0";
        public string AnomalyReason { get; set; } = string.Empty;
        public DateTimeOffset PredictedAt { get; set; }

        /// <summary>Calibrated estimate of the true fraud probability (0-1); FraudProbability is the uncalibrated model score.</summary>
        public decimal? CalibratedProbability { get; set; }

        /// <summary>Top feature attributions for this score (log-odds; positive pushes towards fraud).</summary>
        public List<FactorContributionDto>? TopFactors { get; set; }
    }

    public class FactorContributionDto
    {
        public string Feature { get; set; } = string.Empty;
        public double? Value { get; set; }
        public double Contribution { get; set; }

        /// <summary>transaction | approximated | placeholder | not_provided (see FeatureProvenance).</summary>
        public string? Provenance { get; set; }
    }
}
