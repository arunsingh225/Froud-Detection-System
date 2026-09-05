using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs.FastApi
{
    /// <summary>
    /// Transaction payload schema transmitted to the FastAPI inference engine.
    /// Property names strictly match the Pydantic model defined in Phase 5.
    /// </summary>
    public class FastApiPredictionRequest
    {
        [JsonPropertyName("TransactionAmt")]
        public decimal TransactionAmt { get; set; }

        [JsonPropertyName("ProductCD")]
        public string ProductCD { get; set; } = "W";

        [JsonPropertyName("TransactionDT")]
        public long? TransactionDT { get; set; } = 86400;

        [JsonPropertyName("card1")]
        public int? Card1 { get; set; }

        [JsonPropertyName("card2")]
        public decimal? Card2 { get; set; }

        [JsonPropertyName("card3")]
        public decimal? Card3 { get; set; }

        [JsonPropertyName("card4")]
        public string? Card4 { get; set; }

        [JsonPropertyName("card5")]
        public decimal? Card5 { get; set; }

        [JsonPropertyName("card6")]
        public string? Card6 { get; set; }

        [JsonPropertyName("addr1")]
        public decimal? Addr1 { get; set; }

        [JsonPropertyName("addr2")]
        public decimal? Addr2 { get; set; }

        [JsonPropertyName("dist1")]
        public decimal? Dist1 { get; set; }

        [JsonPropertyName("dist2")]
        public decimal? Dist2 { get; set; }

        [JsonPropertyName("P_emaildomain")]
        public string? PEmailDomain { get; set; }

        [JsonPropertyName("R_emaildomain")]
        public string? REmailDomain { get; set; }

        [JsonPropertyName("DeviceInfo")]
        public string? DeviceInfo { get; set; }

        [JsonPropertyName("DeviceType")]
        public string? DeviceType { get; set; }

        [JsonPropertyName("id_30")]
        public string? Id30 { get; set; }

        [JsonPropertyName("id_31")]
        public string? Id31 { get; set; }

        [JsonPropertyName("id_01")]
        public decimal? Id01 { get; set; }

        [JsonPropertyName("C13")]
        public decimal? C13 { get; set; }

        [JsonPropertyName("D15")]
        public decimal? D15 { get; set; }
    }
}
