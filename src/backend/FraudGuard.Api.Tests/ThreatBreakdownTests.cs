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
    public class AlertCategoriesTests
    {
        [Theory]
        [InlineData("Account Takeover", "new login", AlertCategories.AccountTakeover)]
        [InlineData("Other", "Rooted Device detected", AlertCategories.AccountTakeover)]
        [InlineData("Velocity Anomaly", "burst", AlertCategories.VelocitySpike)]
        [InlineData("Other", "velocity spike on card", AlertCategories.VelocitySpike)]   // case-insensitive
        [InlineData("Synthetic Anomaly Breach", "x", AlertCategories.SyntheticIdentity)]
        [InlineData("Other", "AML watchlist hit", AlertCategories.SyntheticIdentity)]
        [InlineData("Auth Anomaly", "PIN retries", AlertCategories.CardTesting)]
        [InlineData("ML_FRAUD_DETECTION", "flagged with 91.0% probability", AlertCategories.Other)]
        [InlineData("", "", AlertCategories.Other)]
        public void Classify_FollowsRules(string type, string reason, string expected) =>
            Assert.Equal(expected, AlertCategories.Classify(type, reason));

        [Fact]
        public void Classify_FirstRuleWins_WhenSeveralMatch()
        {
            // matches takeover, velocity and card-testing terms: takeover is listed first
            Assert.Equal(AlertCategories.AccountTakeover, AlertCategories.Classify("Takeover Velocity", "Device Auth PIN"));
        }

        [Fact]
        public void Classify_NullSafe_AndAlwaysReturnsAKnownCategory()
        {
            Assert.Equal(AlertCategories.Other, AlertCategories.Classify(null, null));
            Assert.Contains(AlertCategories.Classify("Velocity", null), AlertCategories.All);
        }
    }

    /// <summary>The dashboard breakdown must report exactly the stored categories.</summary>
    public class ThreatBreakdownTests
    {
        private static FraudAlert Alert(string code, string category) => new()
        {
            AlertCode = code, AlertType = "t", Reason = "r", Category = category, Severity = "High", Status = "Open",
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
        public async Task CountsEachStoredCategory_AndEachAlertIsCountedOnce()
        {
            var svc = Build(
                Alert("A1", AlertCategories.AccountTakeover), Alert("A2", AlertCategories.AccountTakeover),
                Alert("A3", AlertCategories.VelocitySpike),
                Alert("A4", AlertCategories.SyntheticIdentity), Alert("A5", AlertCategories.SyntheticIdentity),
                Alert("A6", AlertCategories.SyntheticIdentity),
                Alert("A7", AlertCategories.CardTesting),
                Alert("A8", AlertCategories.Other));

            var t = (await svc.GetDashboardKpisAsync()).ThreatBreakdown;

            Assert.Equal(2, t.AccountTakeoverCount);
            Assert.Equal(1, t.VelocitySpikesCount);
            Assert.Equal(3, t.SyntheticIdentityCount);
            Assert.Equal(1, t.CardTestingCount);
            // "Other" is deliberately not in the breakdown
            Assert.Equal(7, t.AccountTakeoverCount + t.VelocitySpikesCount + t.SyntheticIdentityCount + t.CardTestingCount);
        }

        [Fact]
        public async Task NoAlerts_ReturnsZeros()
        {
            var t = (await Build().GetDashboardKpisAsync()).ThreatBreakdown;
            Assert.Equal(0, t.AccountTakeoverCount + t.VelocitySpikesCount + t.SyntheticIdentityCount + t.CardTestingCount);
        }
    }
}
