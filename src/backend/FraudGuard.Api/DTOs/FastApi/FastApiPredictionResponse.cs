using System;
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
    }
}
