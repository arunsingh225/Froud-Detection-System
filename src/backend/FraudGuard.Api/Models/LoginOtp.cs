using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    /// <summary>A one-time sign-in code sent by SMS. Only a keyed hash of the code is stored.</summary>
    public class LoginOtp
    {
        public Guid OtpId { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }

        [MaxLength(64)]
        public string CodeHash { get; set; } = string.Empty;

        public DateTimeOffset ExpiresAt { get; set; }
        public int Attempts { get; set; }
        public DateTimeOffset? ConsumedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        public User? User { get; set; }
    }
}
