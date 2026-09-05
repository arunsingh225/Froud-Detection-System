namespace FraudGuard.Api.DTOs.Search
{
    public class SearchResultDto
    {
        public string Type { get; set; } = string.Empty; // "transaction", "customer", "alert", "investigation"
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Subtitle { get; set; } = string.Empty;
        public string Route { get; set; } = string.Empty;
    }
}
