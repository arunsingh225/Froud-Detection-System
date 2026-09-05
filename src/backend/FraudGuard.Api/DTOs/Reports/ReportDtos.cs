using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.Reports
{
    public class ReportDto
    {
        public Guid ReportId { get; set; }
        public string ReportCode { get; set; } = string.Empty;
        public Guid? InvestigationId { get; set; }
        public Guid? TransactionId { get; set; }
        public string EntityCode { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string RiskLevel { get; set; } = string.Empty;
        public string GeneratedBy { get; set; } = string.Empty;
        public bool IsAiGenerated { get; set; }
        public string DateFormatted { get; set; } = string.Empty;
        public string TimeFormatted { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? Narrative { get; set; }
        public int FindingsCount { get; set; }
    }

    public class CreateReportDto
    {
        [Required]
        public Guid CustomerId { get; set; }
        public Guid? InvestigationId { get; set; }
        public Guid? TransactionId { get; set; }

        [Required]
        public string ReportTitle { get; set; } = string.Empty;

        [Required]
        public string Category { get; set; } = "SAR Report";

        [Required]
        public string RiskLevel { get; set; } = "HIGH";

        [Required]
        public string Summary { get; set; } = string.Empty;

        public string? Narrative { get; set; }
    }
}
