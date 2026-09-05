using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.FraudAlerts
{
    public class FraudAlertDto
    {
        public Guid AlertId { get; set; }
        public string AlertCode { get; set; } = string.Empty;
        public Guid TransactionId { get; set; }
        public string TransactionCode { get; set; } = string.Empty;
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal AmountInr { get; set; }
        public decimal FraudProbability { get; set; }
        public string RiskTier { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? AssignedTo { get; set; }
        public string Location { get; set; } = string.Empty;
        public string AlertType { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public string CreatedDateFormatted { get; set; } = string.Empty;
        public string CreatedTimeFormatted { get; set; } = string.Empty;
    }

    public class ResolveAlertDto
    {
        public string? Notes { get; set; }
    }

    public class AssignAlertDto
    {
        [Required]
        public Guid UserId { get; set; }
    }
}
