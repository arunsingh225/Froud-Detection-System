using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs.FastApi
{
    /// <summary>
    /// Response payload returned by the FastAPI /predict endpoint.
    /// </summary>
    public class FastApiPredictionResponse
    {
        [JsonPropertyName("request_id")]
        public string RequestId { get; set; } = string.Empty;

        [JsonPropertyName("fraud_probability")]
        public decimal FraudProbability { get; set; }

        [JsonPropertyName("risk_level")]
        public string RiskLevel { get; set; } = "LOW";

        [JsonPropertyName("is_fraud")]
        public bool IsFraud { get; set; }

        [JsonPropertyName("threshold")]
        public decimal Threshold { get; set; } = 0.80m;

        [JsonPropertyName("model_name")]
        public string ModelName { get; set; } = string.Empty;

        [JsonPropertyName("model_version")]
        public string ModelVersion { get; set; } = "1.0";

        [JsonPropertyName("prediction_timestamp")]
        public string PredictionTimestamp { get; set; } = string.Empty;

        /// <summary>Isotonic-calibrated estimate of the true fraud probability (null if the engine has no calibrator).</summary>
        [JsonPropertyName("calibrated_probability")]
        public decimal? CalibratedProbability { get; set; }

        /// <summary>Top TreeSHAP attributions for the raw score (log-odds); present when the request asked for them.</summary>
        [JsonPropertyName("top_factors")]
        public List<FastApiFactorContribution>? TopFactors { get; set; }

        [JsonPropertyName("base_value")]
        public decimal? BaseValue { get; set; }
    }

    public class FastApiFactorContribution
    {
        [JsonPropertyName("feature")]
        public string Feature { get; set; } = string.Empty;

        [JsonPropertyName("value")]
        public double? Value { get; set; }

        [JsonPropertyName("contribution")]
        public double Contribution { get; set; }
    }
}
