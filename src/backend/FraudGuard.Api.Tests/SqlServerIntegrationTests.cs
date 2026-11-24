using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    /// <summary>
    /// Runs only when FG_TEST_SQL is set to a connection string of a THROWAWAY database that already has
    /// sql/01 + sql/02 (seed) + 05 + 06 applied. The EF InMemory provider used elsewhere proves LINQ semantics but
    /// not SQL translation; these tests execute the real queries on SQL Server. They modify data (revocation stamps).
    ///   FG_TEST_SQL="Server=(localdb)\X;Database=Y;Trusted_Connection=True;TrustServerCertificate=True" dotnet test
    /// </summary>
    public sealed class SqlServerFactAttribute : FactAttribute
    {
        public SqlServerFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FG_TEST_SQL")))
                Skip = "Set FG_TEST_SQL to a throwaway SQL Server database to run.";
        }
    }

    public class SqlServerIntegrationTests
    {
        private static string ConnectionString => Environment.GetEnvironmentVariable("FG_TEST_SQL")!;

        private static FraudGuardDbContext NewDb() =>
            new(new DbContextOptionsBuilder<FraudGuardDbContext>().UseSqlServer(ConnectionString).Options);

        [SqlServerFact]
        public async Task DashboardKpis_ExecuteOnSqlServer_AndThreatBreakdownMatchesStoredCategories()
        {
            await using var db = NewDb();
            var svc = new AnalyticsService(db, new Mock<IFastApiClient>().Object,
                new MemoryCache(new MemoryCacheOptions()), new Mock<ILogger<AnalyticsService>>().Object);

            var kpis = await svc.GetDashboardKpisAsync(); // every KPI query must translate to valid SQL

            int Count(string category) => db.FraudAlerts.Count(a => a.Category == category);
            Assert.Equal(Count(AlertCategories.AccountTakeover), kpis.ThreatBreakdown.AccountTakeoverCount);
            Assert.Equal(Count(AlertCategories.VelocitySpike), kpis.ThreatBreakdown.VelocitySpikesCount);
            Assert.Equal(Count(AlertCategories.SyntheticIdentity), kpis.ThreatBreakdown.SyntheticIdentityCount);
            Assert.Equal(Count(AlertCategories.CardTesting), kpis.ThreatBreakdown.CardTestingCount);
            Assert.True(kpis.TotalTransactions >= 0);
        }

        [SqlServerFact]
        public async Task StoredCategories_AgreeWithTheCSharpClassifier()
        {
            await using var db = NewDb();
            var alerts = await db.FraudAlerts.AsNoTracking().Select(a => new { a.AlertCode, a.AlertType, a.Reason, a.Category }).ToListAsync();
            Assert.NotEmpty(alerts);
            foreach (var a in alerts)
                Assert.True(AlertCategories.Classify(a.AlertType, a.Reason) == a.Category,
                    $"{a.AlertCode}: SQL backfill says {a.Category}, C# says {AlertCategories.Classify(a.AlertType, a.Reason)}");
        }

        [SqlServerFact]
        public async Task TokenRevocation_PersistsInSqlServer_AndSurvivesANewServiceInstance()
        {
            Guid userId;
            await using (var db = NewDb()) userId = await db.Users.Select(u => u.UserId).FirstAsync();

            ITokenRevocationService NewService()
            {
                var services = new ServiceCollection();
                services.AddDbContext<FraudGuardDbContext>(o => o.UseSqlServer(ConnectionString));
                return new TokenRevocationService(
                    services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
                    new MemoryCache(new MemoryCacheOptions()));
            }

            var issuedBefore = DateTimeOffset.UtcNow.AddMinutes(-1);
            await NewService().RevokeUserAsync(userId);

            var restarted = NewService(); // empty cache
            Assert.True(await restarted.IsTokenRevokedAsync(userId, issuedBefore));
            Assert.False(await restarted.IsTokenRevokedAsync(userId, DateTimeOffset.UtcNow.AddSeconds(5)));

            await using var verify = NewDb();
            Assert.NotNull((await verify.Users.AsNoTracking().FirstAsync(u => u.UserId == userId)).TokensRevokedAt);
        }

        [SqlServerFact]
        public async Task FailedLogin_WithAVeryLongEmail_IsAuditedWithoutASqlTruncationError()
        {
            // AuditLogs.ActorName is NVARCHAR(100) but the code used to keep up to 200 characters, so a login attempt with a
            // long (still valid-looking) email crashed the audit insert with "String or binary data would be truncated".
            await using var db = NewDb();
            var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(
                new System.Collections.Generic.Dictionary<string, string?> { { "Jwt:SecretKey", "TestSecretKeyForJwtAuthenticationMustBeAtLeast256BitsLong12345678!" } }).Build();
            var auth = new AuthService(db, new JwtTokenService(config),
                new Microsoft.AspNetCore.Identity.PasswordHasher<User>(), new AuditLogService(db), TestRevocation.Create(db));
            var longEmail = new string('a', 150) + "@example.test";

            var result = await auth.LoginAsync(new FraudGuard.Api.DTOs.Auth.LoginRequestDto { Email = longEmail, Password = "wrong-password" });

            Assert.Null(result);   // a plain failed login, not an exception
            var logged = await db.AuditLogs.AsNoTracking().OrderByDescending(a => a.CreatedAt).FirstAsync();
            Assert.Equal(100, logged.ActorName.Length);
        }

        [SqlServerFact]
        public async Task ComplianceRole_IsAcceptedByTheDatabase()
        {
            await using var db = NewDb();
            var u = new User { UserCode = "USR-IT-" + Guid.NewGuid().ToString("N")[..8], FullName = "IT", Role = Roles.Compliance,
                               Email = $"it{Guid.NewGuid():N}@example.test", PasswordHash = "x" };
            db.Users.Add(u);
            await db.SaveChangesAsync();   // would violate CK_Users_Role on a pre-05 schema
            db.Users.Remove(u);
            await db.SaveChangesAsync();
        }
    }
}
