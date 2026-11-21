using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class TokenRevocationPersistenceTests
    {
        private readonly string _dbName = $"revocation_{Guid.NewGuid()}";

        /// <summary>A fresh service graph (empty cache) over the SAME database = an application restart.</summary>
        private TokenRevocationService NewInstance()
        {
            var services = new ServiceCollection();
            services.AddDbContext<FraudGuardDbContext>(o => o.UseInMemoryDatabase(_dbName));
            var provider = services.BuildServiceProvider();
            return new TokenRevocationService(
                provider.GetRequiredService<IServiceScopeFactory>(),
                new MemoryCache(new MemoryCacheOptions()));
        }

        private async Task<Guid> SeedUserAsync(bool active = true)
        {
            var services = new ServiceCollection();
            services.AddDbContext<FraudGuardDbContext>(o => o.UseInMemoryDatabase(_dbName));
            using var provider = services.BuildServiceProvider();
            var db = provider.GetRequiredService<FraudGuardDbContext>();
            var user = new User { UserCode = "USR-T-1", Email = "t@example.test", FullName = "T", IsActive = active };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user.UserId;
        }

        [Fact]
        public async Task Revocation_SurvivesRestart()
        {
            var id = await SeedUserAsync();
            var issued = DateTimeOffset.UtcNow.AddMinutes(-5);

            await NewInstance().RevokeUserAsync(id);

            var afterRestart = NewInstance(); // empty cache, only the database remembers
            Assert.True(await afterRestart.IsTokenRevokedAsync(id, issued));
        }

        [Fact]
        public async Task TokenIssuedAfterRevocation_IsAccepted()
        {
            var id = await SeedUserAsync();
            await NewInstance().RevokeUserAsync(id);

            var svc = NewInstance();
            Assert.False(await svc.IsTokenRevokedAsync(id, DateTimeOffset.UtcNow.AddSeconds(5)));
        }

        [Fact]
        public async Task UserNeverRevoked_IsAccepted()
        {
            var id = await SeedUserAsync();
            Assert.False(await NewInstance().IsTokenRevokedAsync(id, DateTimeOffset.UtcNow));
        }

        [Fact]
        public async Task InactiveOrUnknownUser_IsRejected()
        {
            var inactive = await SeedUserAsync(active: false);
            var svc = NewInstance();
            Assert.True(await svc.IsTokenRevokedAsync(inactive, DateTimeOffset.UtcNow.AddMinutes(1)));
            Assert.True(await svc.IsTokenRevokedAsync(Guid.NewGuid(), DateTimeOffset.UtcNow.AddMinutes(1)));
        }

        [Fact]
        public async Task RevokingInstance_SeesItImmediately_WithoutWaitingForCacheExpiry()
        {
            var id = await SeedUserAsync();
            var svc = NewInstance();
            var issued = DateTimeOffset.UtcNow.AddMinutes(-1);

            Assert.False(await svc.IsTokenRevokedAsync(id, issued)); // primes the cache as "not revoked"
            await svc.RevokeUserAsync(id);
            Assert.True(await svc.IsTokenRevokedAsync(id, issued));  // cache was updated by the revoke
        }
    }
}

namespace FraudGuard.Api.Tests
{
    /// <summary>Builds a real DB-backed revocation service over an existing in-memory context.</summary>
    internal static class TestRevocation
    {
        public static ITokenRevocationService Create(FraudGuardDbContext db)
        {
            var services = new ServiceCollection();
            services.AddScoped(_ => db);
            return new TokenRevocationService(
                services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
                new MemoryCache(new MemoryCacheOptions()));
        }
    }
}
