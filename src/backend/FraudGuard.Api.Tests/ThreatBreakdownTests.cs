using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    /// <summary>The consolidated single-query threat breakdown must equal the four original per-category counts.</summary>
    public class ThreatBreakdownTests
    {
        private static FraudAlert Alert(string code, string type, string reason) => new()
        {
            AlertCode = code, AlertType = type, Reason = reason, Severity = "High", Status = "Open",
            TransactionId = Guid.NewGuid(), CustomerId = Guid.NewGuid()
        };

        private static AnalyticsService Build(params FraudAlert[] alerts)
        {
            var db = new FraudGuardDbContext(new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase($"threat_{Guid.NewGuid()}").Options);
            db.FraudAlerts.AddRange(alerts);
            db.SaveChanges();
            return new AnalyticsService(db, new Mock<IFastApiClient>().Object,
                new MemoryCache(new MemoryCacheOptions()), new Mock<ILogger<AnalyticsService>>().Object);
        }

        [Fact]
        public async Task CountsEachCategoryExactly_IncludingOverlap()
        {
            var svc = Build(
                Alert("A1", "Account Takeover", "new login"),            // ato
                Alert("A2", "Other", "Rooted Device detected"),          // ato (Device)
                Alert("A3", "Velocity Anomaly", "burst"),                // velocity
                Alert("A4", "Other", "Velocity spike on card"),          // velocity
                Alert("A5", "Synthetic Identity", "doc mismatch"),       // synthetic
                Alert("A6", "Other", "AML watchlist hit"),               // synthetic
                Alert("A7", "Auth Failure", "PIN retries"),              // card testing (counted once)
                Alert("A8", "Takeover Velocity", "Device and Velocity"), // ato AND velocity
                Alert("A9", "Benign", "nothing special"));               // none

            var t = (await svc.GetDashboardKpisAsync()).ThreatBreakdown;

            Assert.Equal(3, t.AccountTakeoverCount);   // A1, A2, A8
            Assert.Equal(3, t.VelocitySpikesCount);    // A3, A4, A8
            Assert.Equal(2, t.SyntheticIdentityCount); // A5, A6
            Assert.Equal(1, t.CardTestingCount);       // A7
        }

        [Fact]
        public async Task NoAlerts_ReturnsZeros()
        {
            var t = (await Build().GetDashboardKpisAsync()).ThreatBreakdown;
            Assert.Equal(0, t.AccountTakeoverCount + t.VelocitySpikesCount + t.SyntheticIdentityCount + t.CardTestingCount);
        }
    }
}
