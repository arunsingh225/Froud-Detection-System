using System;

namespace FraudGuard.Api.DTOs.AuditLogs
{
    public class AuditLogDto
    {
        public long AuditLogId { get; set; }
        public string AuditCode { get; set; } = string.Empty;
        public string TimestampFormatted { get; set; } = string.Empty;
        public string DateFormatted { get; set; } = string.Empty;
        public string TimeFormatted { get; set; } = string.Empty;
        public string ActorName { get; set; } = string.Empty;
        public string ActorType { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? SubAction { get; set; }
        public string ResourceTarget { get; set; } = string.Empty;
        public string Result { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? MerkleHash { get; set; }
    }
}
