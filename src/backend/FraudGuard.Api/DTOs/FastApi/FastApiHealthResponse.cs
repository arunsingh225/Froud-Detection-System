using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs.FastApi
{
    /// <summary>
    /// Response payload returned by the FastAPI /health endpoint.
    /// </summary>
    public class FastApiHealthResponse
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("service")]
        public string Service { get; set; } = string.Empty;

        [JsonPropertyName("model_loaded")]
        public bool ModelLoaded { get; set; }

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = string.Empty;
    }
}
