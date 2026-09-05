using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class User
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string UserCode { get; set; } = string.Empty;
        
        [MaxLength(200)]
        public string FullName { get; set; } = string.Empty;
        
        [MaxLength(256)]
        public string Email { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string PasswordHash { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string Role { get; set; } = "INVESTIGATOR"; // ADMIN, INVESTIGATOR, ANALYST, VIEWER
        
        [MaxLength(100)]
        public string? Department { get; set; }
        
        public bool IsActive { get; set; } = true;
        public int AccessFailedCount { get; set; } = 0;
        public DateTimeOffset? LockoutEnd { get; set; }
        public DateTimeOffset? LastLoginAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<FraudAlert> AssignedAlerts { get; set; } = new List<FraudAlert>();
        public ICollection<Investigation> AssignedInvestigations { get; set; } = new List<Investigation>();
        public ICollection<Report> GeneratedReports { get; set; } = new List<Report>();
        public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    }
}
