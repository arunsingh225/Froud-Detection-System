using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using FraudGuard.Api.Data;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Database-backed token revocation. Revoking a user stamps <c>Users.TokensRevokedAt</c>;
    /// any JWT whose "iat" is at or before that instant (or whose user is deleted/inactive) is rejected.
    ///
    /// Survives restarts and is shared by all instances. A short per-instance cache avoids a database
    /// round-trip on every request: the revoking instance updates its cache immediately, other instances
    /// converge within <see cref="CacheTtl"/> (worst-case staleness for a revoked token on another node).
    /// </summary>
    public interface ITokenRevocationService
    {
        Task RevokeUserAsync(Guid userId, CancellationToken ct = default);
        Task<bool> IsTokenRevokedAsync(Guid userId, DateTimeOffset tokenIssuedAt, CancellationToken ct = default);
    }

    public class TokenRevocationService : ITokenRevocationService
    {
        public static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

        // A null cutoff means "not revoked"; DateTimeOffset.MaxValue means "unknown or inactive user: reject".
        private sealed record Cutoff(DateTimeOffset? RevokedAt, bool Active);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMemoryCache _cache;

        public TokenRevocationService(IServiceScopeFactory scopeFactory, IMemoryCache cache)
        {
            _scopeFactory = scopeFactory;
            _cache = cache;
        }

        private static string Key(Guid userId) => $"tokrev:{userId}";

        public async Task RevokeUserAsync(Guid userId, CancellationToken ct = default)
        {
            var now = DateTimeOffset.UtcNow;
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<FraudGuardDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.UserId == userId, ct);
            if (user == null) return;

            user.TokensRevokedAt = now;
            await db.SaveChangesAsync(ct);
            _cache.Set(Key(userId), new Cutoff(now, user.IsActive), CacheTtl);
        }

        public async Task<bool> IsTokenRevokedAsync(Guid userId, DateTimeOffset tokenIssuedAt, CancellationToken ct = default)
        {
            if (!_cache.TryGetValue(Key(userId), out Cutoff? cutoff) || cutoff == null)
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FraudGuardDbContext>();
                var row = await db.Users.AsNoTracking()
                    .Where(u => u.UserId == userId)
                    .Select(u => new { u.TokensRevokedAt, u.IsActive })
                    .FirstOrDefaultAsync(ct);
                // Unknown user (deleted) is treated like a deactivated one.
                cutoff = row == null ? new Cutoff(null, false) : new Cutoff(row.TokensRevokedAt, row.IsActive);
                _cache.Set(Key(userId), cutoff, CacheTtl);
            }

            if (!cutoff.Active) return true;
            // JWT iat has 1-second resolution, so compare at whole-second precision.
            return cutoff.RevokedAt.HasValue &&
                   tokenIssuedAt.ToUnixTimeSeconds() <= cutoff.RevokedAt.Value.ToUnixTimeSeconds();
        }
    }
}
