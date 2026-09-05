using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class FraudAlert
    {
        public Guid AlertId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string AlertCode { get; set; } = string.Empty;
        
        public Guid TransactionId { get; set; }
        public Guid CustomerId { get; set; }
        
        [MaxLength(50)]
        public string Severity { get; set; } = "High"; // Critical, High, Medium, Low
        
        [MaxLength(100)]
        public string AlertType { get; set; } = string.Empty;
        
        [MaxLength(2000)]
        public string Reason { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string Status { get; set; } = "Open"; // Open, Investigating, Escalated, Resolved
        
        public Guid? AssignedToUserId { get; set; }
        public DateTimeOffset? ResolvedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public Transaction? Transaction { get; set; }
        public Customer? Customer { get; set; }
        public User? AssignedToUser { get; set; }
        public ICollection<Investigation> Investigations { get; set; } = new List<Investigation>();
    }

    public class Investigation
    {
        public Guid InvestigationId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string InvestigationCode { get; set; } = string.Empty;
        
        public Guid? AlertId { get; set; }
        public Guid TransactionId { get; set; }
        public Guid CustomerId { get; set; }
        
        [MaxLength(50)]
        public string Priority { get; set; } = "Medium"; // Critical, High, Medium, Low
        
        [MaxLength(50)]
        public string Status { get; set; } = "New"; // New, Investigating, Pending Review, Escalated, Resolved, Approved, Rejected
        
        public Guid? AssignedInvestigatorId { get; set; }
        
        [MaxLength(100)]
        public string? ResolutionDecision { get; set; } // Approved, Auto-Flag for Review, Escalated, Rejected
        
        [MaxLength(4000)]
        public string? ResolutionNotes { get; set; }
        
        public DateTimeOffset? ResolvedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public FraudAlert? Alert { get; set; }
        public Transaction? Transaction { get; set; }
        public Customer? Customer { get; set; }
        public User? AssignedInvestigator { get; set; }
        public ICollection<InvestigationEvidence> Evidence { get; set; } = new List<InvestigationEvidence>();
        public ICollection<InvestigationTimeline> Timeline { get; set; } = new List<InvestigationTimeline>();
        public ICollection<Report> Reports { get; set; } = new List<Report>();
    }
}
