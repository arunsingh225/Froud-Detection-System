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
        
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;
        
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;
        
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;
        
        [MaxLength(30)]
        public string Role { get; set; } = "INVESTIGATOR"; // ADMIN, INVESTIGATOR, ANALYST, VIEWER
        
        [MaxLength(100)]
        public string? Department { get; set; }

        /// <summary>Phone number in E.164 form (for example +919876543210); used for one-time-code sign-in.</summary>
        [MaxLength(20)]
        public string? PhoneNumber { get; set; }
        
        public bool IsActive { get; set; } = true;
        public int AccessFailedCount { get; set; } = 0;
        public DateTimeOffset? LockoutEnd { get; set; }
        public DateTimeOffset? LastLoginAt { get; set; }
        /// <summary>Tokens issued at or before this instant are rejected (logout, role change, deactivation).</summary>
        public DateTimeOffset? TokensRevokedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<FraudAlert> AssignedAlerts { get; set; } = new List<FraudAlert>();
        public ICollection<Investigation> AssignedInvestigations { get; set; } = new List<Investigation>();
        public ICollection<Report> GeneratedReports { get; set; } = new List<Report>();
        public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    }
}
