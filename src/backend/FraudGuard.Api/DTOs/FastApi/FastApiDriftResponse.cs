using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs.FastApi
{
    /// <summary>Response payload returned by the FastAPI GET /model/drift endpoint.</summary>
    public class FastApiDriftResponse
    {
        [JsonPropertyName("status")] public string Status { get; set; } = "unavailable";
        [JsonPropertyName("n_samples")] public int NSamples { get; set; }
        [JsonPropertyName("min_samples")] public int MinSamples { get; set; }
        [JsonPropertyName("window")] public int Window { get; set; }
        [JsonPropertyName("max_psi")] public double? MaxPsi { get; set; }
        [JsonPropertyName("features")] public List<FastApiDriftFeature> Features { get; set; } = new();
    }

    public class FastApiDriftFeature
    {
        [JsonPropertyName("feature")] public string Feature { get; set; } = string.Empty;
        [JsonPropertyName("psi")] public double Psi { get; set; }
        [JsonPropertyName("status")] public string Status { get; set; } = "stable";
    }
}
