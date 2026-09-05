using System;

namespace FraudGuard.Api.DTOs.Fraud
{
    /// <summary>
    /// Combined health status of the ASP.NET Core API and the FastAPI ML inference engine.
    /// </summary>
    public class EngineHealthDto
    {
        public string AspNetCore { get; set; } = "healthy";
        public string FastApi { get; set; } = "healthy";
        public bool ModelLoaded { get; set; }
        public DateTimeOffset CheckedAt { get; set; } = DateTimeOffset.UtcNow;
        public string? Message { get; set; }
    }

    /// <summary>
    /// Metadata describing the resident ML model served by the FastAPI engine.
    /// </summary>
    public class FraudModelInfoDto
    {
        public string ModelName { get; set; } = string.Empty;
        public string ModelVersion { get; set; } = "1.0";
        public decimal RocAuc { get; set; }
        public decimal PrAuc { get; set; }
        public decimal Threshold { get; set; }
        public int FeatureCount { get; set; }
        public string? TrainingDate { get; set; }
    }
}
