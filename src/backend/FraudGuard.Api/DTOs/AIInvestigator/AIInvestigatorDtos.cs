using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs.AIInvestigator
{
    public class InvestigateRequestDto
    {
        public Guid TransactionId { get; set; }
        public Guid? AlertId { get; set; }
        public string? Prompt { get; set; }
    }

    public class FastApiInvestigationRequest
    {
        [JsonPropertyName("transaction_id")]
        public string TransactionId { get; set; } = string.Empty;

        [JsonPropertyName("transaction_code")]
        public string? TransactionCode { get; set; }

        [JsonPropertyName("alert_id")]
        public string? AlertId { get; set; }

        [JsonPropertyName("amount_inr")]
        public decimal AmountInr { get; set; }

        [JsonPropertyName("amount_usd")]
        public decimal? AmountUsd { get; set; }

        [JsonPropertyName("payment_method")]
        public string? PaymentMethod { get; set; }

        [JsonPropertyName("merchant_name")]
        public string? MerchantName { get; set; }

        [JsonPropertyName("merchant_category")]
        public string? MerchantCategory { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("country")]
        public string? Country { get; set; }

        [JsonPropertyName("distance_from_typical_km")]
        public decimal? DistanceFromTypicalKm { get; set; }

        [JsonPropertyName("ip_address")]
        public string? IpAddress { get; set; }

        [JsonPropertyName("vpn_or_proxy_detected")]
        public bool? VpnOrProxyDetected { get; set; }

        [JsonPropertyName("tor_exit_node")]
        public bool? TorExitNode { get; set; }

        [JsonPropertyName("device_type")]
        public string? DeviceType { get; set; }

        [JsonPropertyName("os")]
        public string? Os { get; set; }

        [JsonPropertyName("browser")]
        public string? Browser { get; set; }

        [JsonPropertyName("is_emulator")]
        public bool? IsEmulator { get; set; }

        [JsonPropertyName("is_rooted_or_jailbroken")]
        public bool? IsRootedOrJailbroken { get; set; }

        [JsonPropertyName("customer_id")]
        public string? CustomerId { get; set; }

        [JsonPropertyName("customer_name")]
        public string? CustomerName { get; set; }

        [JsonPropertyName("customer_baseline_avg_amount")]
        public decimal? CustomerBaselineAvgAmount { get; set; }

        [JsonPropertyName("customer_rolling_30d_volume")]
        public decimal? CustomerRolling30dVolume { get; set; }

        [JsonPropertyName("customer_risk_score")]
        public decimal? CustomerRiskScore { get; set; }

        [JsonPropertyName("customer_risk_tier")]
        public string? CustomerRiskTier { get; set; }

        [JsonPropertyName("customer_prior_flags_count")]
        public int? CustomerPriorFlagsCount { get; set; }

        [JsonPropertyName("account_id")]
        public string? AccountId { get; set; }

        [JsonPropertyName("account_number")]
        public string? AccountNumber { get; set; }

        [JsonPropertyName("current_balance")]
        public decimal? CurrentBalance { get; set; }

        [JsonPropertyName("daily_limit")]
        public decimal? DailyLimit { get; set; }

        [JsonPropertyName("recent_transactions_count")]
        public int? RecentTransactionsCount { get; set; }

        [JsonPropertyName("recent_high_risk_alerts_count")]
        public int? RecentHighRiskAlertsCount { get; set; }

        [JsonPropertyName("model_fraud_probability")]
        public decimal? ModelFraudProbability { get; set; }

        [JsonPropertyName("model_risk_tier")]
        public string? ModelRiskTier { get; set; }

        [JsonPropertyName("model_is_fraud")]
        public bool? ModelIsFraud { get; set; }

        [JsonPropertyName("prompt")]
        public string? Prompt { get; set; }
    }

    public class EvidenceItemDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("finding_type")]
        public string FindingType { get; set; } = string.Empty;

        [JsonPropertyName("finding_detail")]
        public string FindingDetail { get; set; } = string.Empty;

        [JsonPropertyName("confidence")]
        public decimal Confidence { get; set; }

        [JsonPropertyName("severity")]
        public string Severity { get; set; } = string.Empty;

        [JsonPropertyName("source")]
        public string Source { get; set; } = string.Empty;
    }

    public class SuspiciousFindingDto
    {
        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("severity")]
        public string Severity { get; set; } = string.Empty;

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = string.Empty;

        [JsonPropertyName("evidence_ids")]
        public List<string> EvidenceIds { get; set; } = new();
    }

    public class PolicyCitationDto
    {
        [JsonPropertyName("document")]
        public string Document { get; set; } = string.Empty;

        [JsonPropertyName("section")]
        public string Section { get; set; } = string.Empty;

        [JsonPropertyName("chunk_id")]
        public string ChunkId { get; set; } = string.Empty;

        [JsonPropertyName("source")]
        public string Source { get; set; } = string.Empty;

        [JsonPropertyName("excerpt")]
        public string Excerpt { get; set; } = string.Empty;
    }

    public class InvestigationResultDto
    {
        [JsonPropertyName("investigation_id")]
        public string InvestigationId { get; set; } = string.Empty;

        [JsonPropertyName("transaction_id")]
        public string TransactionId { get; set; } = string.Empty;

        [JsonPropertyName("risk_tier")]
        public string RiskTier { get; set; } = string.Empty;

        [JsonPropertyName("fraud_probability")]
        public decimal FraudProbability { get; set; }

        [JsonPropertyName("decision")]
        public string Decision { get; set; } = string.Empty;

        [JsonPropertyName("summary")]
        public string Summary { get; set; } = string.Empty;

        [JsonPropertyName("findings")]
        public List<SuspiciousFindingDto> Findings { get; set; } = new();

        [JsonPropertyName("evidence")]
        public List<EvidenceItemDto> Evidence { get; set; } = new();

        [JsonPropertyName("policy_references")]
        public List<PolicyCitationDto> PolicyReferences { get; set; } = new();

        [JsonPropertyName("recommended_action")]
        public string RecommendedAction { get; set; } = string.Empty;

        [JsonPropertyName("confidence")]
        public decimal Confidence { get; set; }

        [JsonPropertyName("disclaimer")]
        public string Disclaimer { get; set; } = string.Empty;

        [JsonPropertyName("provider_metadata")]
        public Dictionary<string, object>? ProviderMetadata { get; set; }
    }

    public class InvestigationDetailFullDto
    {
        public Guid InvestigationId { get; set; }
        public string InvestigationCode { get; set; } = string.Empty;
        public Guid TransactionId { get; set; }
        public string TransactionCode { get; set; } = string.Empty;
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal AmountInr { get; set; }
        public string RiskTier { get; set; } = string.Empty;
        public decimal FraudProbability { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string? ResolutionDecision { get; set; }
        public string? ResolutionNotes { get; set; }
        public string Summary { get; set; } = string.Empty;
        public string RecommendedAction { get; set; } = string.Empty;
        public decimal Confidence { get; set; }
        public List<EvidenceItemDto> Evidence { get; set; } = new();
        public List<SuspiciousFindingDto> Findings { get; set; } = new();
        public List<PolicyCitationDto> PolicyReferences { get; set; } = new();
        public List<InvestigationTimelineDto> Timeline { get; set; } = new();
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class InvestigationTimelineDto
    {
        public Guid TimelineId { get; set; }
        public int StepNumber { get; set; }
        public string Label { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string ActorType { get; set; } = string.Empty;
        public string ActorName { get; set; } = string.Empty;
        public DateTimeOffset StepTimestamp { get; set; }
    }
}
