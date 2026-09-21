using System;
using System.Collections.Concurrent;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// In-memory token revocation service. Tracks user IDs whose tokens have been
    /// invalidated (due to logout, deactivation, or role change) along with the
    /// revocation timestamp. Tokens issued before the revocation time are rejected.
    ///
    /// Tradeoff: On application restart the revocation set is cleared, but existing
    /// JWT tokens are still validated by expiry and signature. For a single-instance
    /// deployment this is production-appropriate without requiring Redis or database changes.
    /// </summary>
    public interface ITokenRevocationService
    {
        void RevokeUser(Guid userId);
        bool IsTokenRevoked(Guid userId, DateTimeOffset tokenIssuedAt);
    }

    public class TokenRevocationService : ITokenRevocationService
    {
        // Maps userId → the time at which all their tokens were revoked
        private readonly ConcurrentDictionary<Guid, DateTimeOffset> _revokedUsers = new();

        public void RevokeUser(Guid userId)
        {
            _revokedUsers[userId] = DateTimeOffset.UtcNow;
        }

        public bool IsTokenRevoked(Guid userId, DateTimeOffset tokenIssuedAt)
        {
            if (_revokedUsers.TryGetValue(userId, out var revokedAt))
            {
                // Token issued before revocation → revoked
                return tokenIssuedAt <= revokedAt;
            }
            return false;
        }
    }
}
