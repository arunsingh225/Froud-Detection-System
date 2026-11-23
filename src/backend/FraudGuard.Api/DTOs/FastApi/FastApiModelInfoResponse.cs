using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs.FastApi
{
    /// <summary>
    /// Response payload returned by the FastAPI /model-info endpoint.
    /// </summary>
    public class FastApiModelInfoResponse
    {
        [JsonPropertyName("model_name")]
        public string ModelName { get; set; } = string.Empty;

        [JsonPropertyName("model_version")]
        public string ModelVersion { get; set; } = "1.0";

        [JsonPropertyName("roc_auc")]
        public decimal RocAuc { get; set; }

        [JsonPropertyName("pr_auc")]
        public decimal PrAuc { get; set; }

        [JsonPropertyName("threshold")]
        public decimal Threshold { get; set; }

        [JsonPropertyName("feature_count")]
        public int FeatureCount { get; set; }

        [JsonPropertyName("training_date")]
        public string? TrainingDate { get; set; }

        [JsonPropertyName("calibration_method")]
        public string? CalibrationMethod { get; set; }

        /// <summary>ROC-AUC on the held-out TEST half (models/holdout_evaluation.json).</summary>
        [JsonPropertyName("holdout_roc_auc")]
        public decimal? HoldoutRocAuc { get; set; }

        [JsonPropertyName("holdout_pr_auc")]
        public decimal? HoldoutPrAuc { get; set; }
    }
}
