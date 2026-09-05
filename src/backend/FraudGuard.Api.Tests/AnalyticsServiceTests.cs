using System;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Analytics;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class AnalyticsServiceTests
    {
        private readonly Mock<IFastApiClient> _fastApiMock = new();
        private readonly IMemoryCache _cache = new MemoryCache(new MemoryCacheOptions());
        private readonly Mock<ILogger<AnalyticsService>> _loggerMock = new();

        private FraudGuardDbContext CreateInMemoryContext()
        {
            var options = new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase(databaseName: $"FraudGuard_AnalyticsTest_{Guid.NewGuid()}")
                .Options;

            var db = new FraudGuardDbContext(options);

            // Seed customers
            var cust1 = new Customer
            {
                CustomerId = Guid.NewGuid(),
                CustomerCode = "CUS-TEST-01",
                FullName = "Alice Johnson",
                Email = "alice@example.com",
                RiskScore = 85.0m,
                RiskTier = "High"
            };
            var cust2 = new Customer
            {
                CustomerId = Guid.NewGuid(),
                CustomerCode = "CUS-TEST-02",
                FullName = "Bob Smith",
                Email = "bob@example.com",
                RiskScore = 20.0m,
                RiskTier = "Low"
            };
            db.Customers.AddRange(cust1, cust2);

            // Seed merchants
            var merch1 = new Merchant
            {
                MerchantId = Guid.NewGuid(),
                MerchantCode = "MER-001",
                MerchantName = "Crypto Hub",
                Category = "Crypto",
                MCC = "6051",
                RiskCategory = "High"
            };
            var merch2 = new Merchant
            {
                MerchantId = Guid.NewGuid(),
                MerchantCode = "MER-002",
                MerchantName = "Super Mart",
                Category = "Grocery",
                MCC = "5411",
                RiskCategory = "Low"
            };
            db.Merchants.AddRange(merch1, merch2);

            // Seed accounts
            var acc1 = new Account { AccountId = Guid.NewGuid(), CustomerId = cust1.CustomerId, AccountNumber = "ACC-01" };
            db.Accounts.Add(acc1);

            // Seed transactions
            var txn1 = new Transaction
            {
                TransactionId = Guid.NewGuid(),
                TransactionCode = "TXN-001",
                AccountId = acc1.AccountId,
                CustomerId = cust1.CustomerId,
                MerchantId = merch1.MerchantId,
                AmountInr = 500000m,
                AmountUsd = 6000m,
                PaymentMethod = "UPI",
                IPAddress = "1.2.3.4",
                City = "Mumbai",
                Country = "India",
                TransactionTimestamp = DateTimeOffset.UtcNow.AddDays(-2),
                Status = "Pending Review"
            };
            var txn2 = new Transaction
            {
                TransactionId = Guid.NewGuid(),
                TransactionCode = "TXN-002",
                AccountId = acc1.AccountId,
                CustomerId = cust2.CustomerId,
                MerchantId = merch2.MerchantId,
                AmountInr = 1500m,
                AmountUsd = 18m,
                PaymentMethod = "Card",
                IPAddress = "5.6.7.8",
                City = "Delhi",
                Country = "India",
                TransactionTimestamp = DateTimeOffset.UtcNow.AddDays(-1),
                Status = "Approved"
            };
            db.Transactions.AddRange(txn1, txn2);

            // Seed predictions
            var pred1 = new FraudPrediction
            {
                PredictionId = Guid.NewGuid(),
                TransactionId = txn1.TransactionId,
                FraudProbability = 92.5m,
                RiskTier = "Critical",
                AnomalyReason = "High velocity and high amount."
            };
            var pred2 = new FraudPrediction
            {
                PredictionId = Guid.NewGuid(),
                TransactionId = txn2.TransactionId,
                FraudProbability = 12.0m,
                RiskTier = "Low",
                AnomalyReason = "Routine transaction."
            };
            db.FraudPredictions.AddRange(pred1, pred2);

            // Seed alerts
            var alert1 = new FraudAlert
            {
                AlertId = Guid.NewGuid(),
                AlertCode = "ALT-001",
                TransactionId = txn1.TransactionId,
                CustomerId = cust1.CustomerId,
                Severity = "Critical",
                AlertType = "Velocity Anomaly",
                Reason = "High value transfer",
                Status = "New",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-10)
            };
            db.FraudAlerts.Add(alert1);

            db.SaveChanges();
            return db;
        }

        [Fact]
        public async Task GetDashboardKpisAsync_CalculatesRealMetricsFromDatabase()
        {
            // Arrange
            var db = CreateInMemoryContext();
            var service = new AnalyticsService(db, _fastApiMock.Object, _cache, _loggerMock.Object);

            // Act
            var kpis = await service.GetDashboardKpisAsync();

            // Assert
            Assert.Equal(2, kpis.TotalTransactions);
            Assert.Equal(501500m, kpis.TotalTransactionValueInr);
            Assert.Equal(250750m, kpis.AverageTransactionValueInr);
            Assert.Equal(1, kpis.FraudFlaggedCount);
            Assert.Equal(50.0m, kpis.FraudRatePercentage);
            Assert.Equal(1, kpis.CriticalRiskCount);
            Assert.Equal(0, kpis.HighRiskCount);
            Assert.Equal(1, kpis.TotalAlertsCount);
            Assert.Equal(1, kpis.OpenAlertsCount);
            Assert.Equal(500000m, kpis.PreventedFraudLossInr);
        }

        [Fact]
        public async Task GetRiskDistributionAsync_ReturnsExactTierCounts()
        {
            // Arrange
            var db = CreateInMemoryContext();
            var service = new AnalyticsService(db, _fastApiMock.Object, _cache, _loggerMock.Object);

            // Act
            var dist = await service.GetRiskDistributionAsync();

            // Assert
            Assert.Equal(1, dist.Critical);
            Assert.Equal(0, dist.High);
            Assert.Equal(0, dist.Medium);
            Assert.Equal(1, dist.Low);
            Assert.Equal(2, dist.Total);
        }

        [Fact]
        public async Task GetFraudTrendsAsync_AggregatesWithinRequestedPeriod()
        {
            // Arrange
            var db = CreateInMemoryContext();
            var service = new AnalyticsService(db, _fastApiMock.Object, _cache, _loggerMock.Object);

            // Act
            var trends7d = await service.GetFraudTrendsAsync("7d");
            var trends24h = await service.GetFraudTrendsAsync("24h");

            // Assert
            Assert.Equal("7d", trends7d.Period);
            Assert.Equal(7, trends7d.Points.Count);
            Assert.Equal("24h", trends24h.Period);
            Assert.Equal(6, trends24h.Points.Count);
        }

        [Fact]
        public async Task ExportDataCsvAsync_GeneratesSanitizedCsvHeaderAndRows()
        {
            // Arrange
            var db = CreateInMemoryContext();
            var service = new AnalyticsService(db, _fastApiMock.Object, _cache, _loggerMock.Object);

            // Act
            var csvBytes = await service.ExportDataCsvAsync("fraud-alerts");
            var csvText = Encoding.UTF8.GetString(csvBytes);

            // Assert
            Assert.Contains("AlertCode,TransactionCode,CustomerName,Severity,Status,Reason", csvText);
            Assert.Contains("ALT-001", csvText);
            Assert.Contains("Critical", csvText);
            Assert.DoesNotContain("Password", csvText);
            Assert.DoesNotContain("Hash", csvText);
        }
    }
}
