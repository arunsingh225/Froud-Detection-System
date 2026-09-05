using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class Report
    {
        public Guid ReportId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string ReportCode { get; set; } = string.Empty;
        
        public Guid? InvestigationId { get; set; }
        public Guid? TransactionId { get; set; }
        public Guid CustomerId { get; set; }
        
        [MaxLength(200)]
        public string ReportTitle { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string Category { get; set; } = "SAR Report"; // SAR Report, AML Audit Summary, Account Takeover, Velocity Anomaly
        
        [MaxLength(50)]
        public string RiskLevel { get; set; } = "HIGH"; // CRITICAL, HIGH, MEDIUM, LOW
        
        public Guid? GeneratedByUserId { get; set; }
        public bool IsAiGenerated { get; set; } = false;
        
        [MaxLength(50)]
        public string Status { get; set; } = "Draft"; // Draft, Under Review, Published, Archived
        
        [MaxLength(2000)]
        public string Summary { get; set; } = string.Empty;
        
        [MaxLength(4000)]
        public string? Narrative { get; set; }
        
        public int FindingsCount { get; set; } = 0;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public Investigation? Investigation { get; set; }
        public Transaction? Transaction { get; set; }
        public Customer? Customer { get; set; }
        public User? GeneratedByUser { get; set; }
    }

    public class AuditLog
    {
        public long AuditLogId { get; set; }
        
        [MaxLength(50)]
        public string AuditCode { get; set; } = string.Empty;
        
        public Guid? ActorId { get; set; }
        
        [MaxLength(200)]
        public string ActorName { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string ActorType { get; set; } = "INVESTIGATOR"; // AI AGENT, INVESTIGATOR, SERVICE, ADMIN, EXTERNAL
        
        [MaxLength(100)]
        public string Action { get; set; } = string.Empty;
        
        [MaxLength(200)]
        public string? SubAction { get; set; }
        
        [MaxLength(200)]
        public string ResourceTarget { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string Result { get; set; } = "SUCCESS"; // SUCCESS, PENDING, FAILED
        
        [MaxLength(100)]
        public string Category { get; set; } = "Investigation"; // Authentication, Investigation, Policy Change, Data Export, Rule Modification
        
        [MaxLength(4000)]
        public string? DetailsJson { get; set; }
        
        [MaxLength(45)]
        public string? IPAddress { get; set; }
        
        [MaxLength(128)]
        public string? MerkleHash { get; set; }
        
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        public User? Actor { get; set; }
    }
}
