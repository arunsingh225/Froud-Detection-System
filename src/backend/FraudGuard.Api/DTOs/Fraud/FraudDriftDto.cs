using System.Collections.Generic;

namespace FraudGuard.Api.DTOs.Fraud
{
    /// <summary>Input drift (PSI) of recent scoring traffic against the reference distribution of the model.</summary>
    public class FraudDriftDto
    {
        /// <summary>stable | moderate | significant | insufficient_data | unavailable</summary>
        public string Status { get; set; } = "unavailable";
        public int SampleCount { get; set; }
        public int MinSamples { get; set; }
        public int Window { get; set; }
        public double? MaxPsi { get; set; }
        public List<FraudDriftFeatureDto> Features { get; set; } = new();
    }

    public class FraudDriftFeatureDto
    {
        public string Feature { get; set; } = string.Empty;
        public double Psi { get; set; }
        public string Status { get; set; } = "stable";
    }
}
