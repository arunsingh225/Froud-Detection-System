using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.Investigations
{
    public class InvestigationDto
    {
        public Guid InvestigationId { get; set; }
        public string InvestigationCode { get; set; } = string.Empty;
        public Guid TransactionId { get; set; }
        public string TransactionCode { get; set; } = string.Empty;
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string RiskTier { get; set; } = string.Empty;
        public decimal FraudProbability { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string AssignedInvestigator { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ResolutionDecision { get; set; }
        public decimal AmountInr { get; set; }
        public string Location { get; set; } = string.Empty;
        public string AlertReason { get; set; } = string.Empty;
        public string CreatedDateFormatted { get; set; } = string.Empty;
        public string LastUpdatedFormatted { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class InvestigationDetailDto : InvestigationDto
    {
        public List<EvidenceDto> Evidence { get; set; } = new List<EvidenceDto>();
        public List<TimelineStepDto> Timeline { get; set; } = new List<TimelineStepDto>();
    }

    public class EvidenceDto
    {
        public Guid EvidenceId { get; set; }
        public string Category { get; set; } = string.Empty;
        public string FindingType { get; set; } = string.Empty;
        public string FindingDetail { get; set; } = string.Empty;
        public decimal Confidence { get; set; }
        public string Severity { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string FormattedTimestamp { get; set; } = string.Empty;
    }

    public class TimelineStepDto
    {
        public Guid TimelineId { get; set; }
        public int StepNumber { get; set; }
        public string Label { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string ActorType { get; set; } = string.Empty;
        public string ActorName { get; set; } = string.Empty;
        public string FormattedTimestamp { get; set; } = string.Empty;
    }

    public class CreateInvestigationDto
    {
        [Required]
        public Guid TransactionId { get; set; }

        public Guid? AlertId { get; set; }
        public string Priority { get; set; } = "Medium";
        public Guid? AssignedInvestigatorId { get; set; }
    }

    public class InvestigationDecisionDto
    {
        [Required]
        public string Decision { get; set; } = string.Empty; // Approved, Auto-Flag for Review, Escalated, Rejected

        public string? Notes { get; set; }
    }
}
