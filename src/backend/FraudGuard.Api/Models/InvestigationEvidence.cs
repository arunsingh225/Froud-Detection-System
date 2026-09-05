using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class InvestigationEvidence
    {
        public Guid EvidenceId { get; set; } = Guid.NewGuid();
        public Guid InvestigationId { get; set; }
        
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty; // Transaction, Behavioral, Device, Location, ML, Policy
        
        [MaxLength(200)]
        public string FindingType { get; set; } = string.Empty;
        
        [MaxLength(2000)]
        public string FindingDetail { get; set; } = string.Empty;
        
        public decimal Confidence { get; set; }
        
        [MaxLength(50)]
        public string Severity { get; set; } = "medium"; // critical, high, medium, low, info
        
        [MaxLength(200)]
        public string Source { get; set; } = string.Empty;
        
        public DateTimeOffset EvidenceTimestamp { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        public Investigation? Investigation { get; set; }
    }

    public class InvestigationTimeline
    {
        public Guid TimelineId { get; set; } = Guid.NewGuid();
        public Guid InvestigationId { get; set; }
        public int StepNumber { get; set; }
        
        [MaxLength(200)]
        public string Label { get; set; } = string.Empty;
        
        [MaxLength(2000)]
        public string Description { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string Status { get; set; } = "pending"; // completed, active, pending
        
        [MaxLength(50)]
        public string ActorType { get; set; } = "system"; // system, ai, human
        
        [MaxLength(200)]
        public string ActorName { get; set; } = string.Empty;
        
        public DateTimeOffset StepTimestamp { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        public Investigation? Investigation { get; set; }
    }
}
