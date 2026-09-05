using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class FraudPredictionServiceTests
    {
        private readonly Mock<IFastApiClient> _fastApiClientMock = new();
        private readonly Mock<ILogger<FraudPredictionService>> _loggerMock = new();
        private readonly FraudPredictionMapper _mapper = new();

        private static FraudGuardDbContext CreateInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            return new FraudGuardDbContext(options);
        }

        private static async Task<Transaction> CreateTransactionWithParentsAsync(FraudGuardDbContext db, decimal amountInr, string code)
        {
            var customer = new Customer
            {
                CustomerId = Guid.NewGuid(),
                FullName = "Vikram Malhotra",
                Email = "vikram.m@axisbank.com"
            };
            var account = new Account
            {
                AccountId = Guid.NewGuid(),
                CustomerId = customer.CustomerId,
                AccountNumber = $"ACC-{Guid.NewGuid().ToString()[..8]}"
            };
            db.Customers.Add(customer);
            db.Accounts.Add(account);

            var txn = new Transaction
            {
                TransactionCode = code,
                CustomerId = customer.CustomerId,
                AccountId = account.AccountId,
                AmountInr = amountInr,
                PaymentMethod = "Visa Credit",
                City = "Mumbai",
                Country = "India",
                Status = "Pending Review"
            };
            db.Transactions.Add(txn);
            await db.SaveChangesAsync();
            return txn;
        }

        [Fact]
        public async Task PredictAndProcessAsync_WhenHighRisk_PersistsPredictionAndCreatesAlert()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var txn = await CreateTransactionWithParentsAsync(db, 500000m, "TXN-TEST-001");
            var txnId = txn.TransactionId;

            var expectedRequestId = Guid.NewGuid().ToString();
            _fastApiClientMock.Setup(c => c.PredictAsync(It.IsAny<FastApiPredictionRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FastApiPredictionResponse
                {
                    RequestId = expectedRequestId,
                    FraudProbability = 0.8850m,
                    RiskLevel = "CRITICAL",
                    IsFraud = true,
                    Threshold = 0.80m,
                    ModelName = "LightGBM_Fraud_Classifier",
                    ModelVersion = "1.0"
                });

            var service = new FraudPredictionService(db, _fastApiClientMock.Object, _mapper, _loggerMock.Object);

            // Act
            var result = await service.PredictAndProcessAsync(txnId);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(0.8850m, result.FraudProbability);
            Assert.Equal("CRITICAL", result.RiskLevel);
            Assert.True(result.IsFraud);
            Assert.True(result.AlertCreated);
            Assert.NotNull(result.AlertId);
            Assert.Equal(expectedRequestId, result.RequestId);

            // Verify Database Persistence
            var savedPrediction = await db.FraudPredictions.FirstOrDefaultAsync(fp => fp.TransactionId == txnId);
            Assert.NotNull(savedPrediction);
            Assert.Equal(88.50m, savedPrediction.FraudProbability);
            Assert.Equal("Critical", savedPrediction.RiskTier);
            Assert.Equal("LightGBM_Fraud_Classifier", savedPrediction.ModelName);

            var savedAlert = await db.FraudAlerts.FirstOrDefaultAsync(fa => fa.TransactionId == txnId);
            Assert.NotNull(savedAlert);
            Assert.Equal("Critical", savedAlert.Severity);
            Assert.Equal("Open", savedAlert.Status);

            var updatedTxn = await db.Transactions.FindAsync(txnId);
            Assert.Equal("Investigating", updatedTxn!.Status);

            var auditLog = await db.AuditLogs.FirstOrDefaultAsync(al => al.ResourceTarget == $"Transaction/{txnId}");
            Assert.NotNull(auditLog);
            Assert.Contains(expectedRequestId, auditLog.DetailsJson!);
        }

        [Fact]
        public async Task PredictAndProcessAsync_WhenLowRisk_PersistsPredictionWithoutCreatingAlert()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var txn = await CreateTransactionWithParentsAsync(db, 1500m, "TXN-TEST-002");
            var txnId = txn.TransactionId;

            _fastApiClientMock.Setup(c => c.PredictAsync(It.IsAny<FastApiPredictionRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FastApiPredictionResponse
                {
                    RequestId = Guid.NewGuid().ToString(),
                    FraudProbability = 0.0520m,
                    RiskLevel = "LOW",
                    IsFraud = false,
                    Threshold = 0.80m,
                    ModelName = "LightGBM_Fraud_Classifier",
                    ModelVersion = "1.0"
                });

            var service = new FraudPredictionService(db, _fastApiClientMock.Object, _mapper, _loggerMock.Object);

            // Act
            var result = await service.PredictAndProcessAsync(txnId);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(0.0520m, result.FraudProbability);
            Assert.Equal("LOW", result.RiskLevel);
            Assert.False(result.IsFraud);
            Assert.False(result.AlertCreated);
            Assert.Null(result.AlertId);

            // Verify no FraudAlert was created in DB
            var alertCount = await db.FraudAlerts.CountAsync(fa => fa.TransactionId == txnId);
            Assert.Equal(0, alertCount);
        }

        [Fact]
        public async Task PredictAndProcessAsync_Idempotency_DoesNotDuplicateOpenAlerts()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var txn = await CreateTransactionWithParentsAsync(db, 250000m, "TXN-TEST-003");
            var txnId = txn.TransactionId;

            _fastApiClientMock.Setup(c => c.PredictAsync(It.IsAny<FastApiPredictionRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FastApiPredictionResponse
                {
                    RequestId = Guid.NewGuid().ToString(),
                    FraudProbability = 0.9200m,
                    RiskLevel = "CRITICAL",
                    IsFraud = true,
                    Threshold = 0.80m,
                    ModelName = "LightGBM_Fraud_Classifier",
                    ModelVersion = "1.0"
                });

            var service = new FraudPredictionService(db, _fastApiClientMock.Object, _mapper, _loggerMock.Object);

            // Act 1: First prediction generates alert
            var result1 = await service.PredictAndProcessAsync(txnId);
            Assert.True(result1.AlertCreated);

            // Act 2: Second prediction on same transaction should be idempotent
            var result2 = await service.PredictAndProcessAsync(txnId);

            // Assert
            Assert.False(result2.AlertCreated); // Alert was NOT duplicated
            var alertCount = await db.FraudAlerts.CountAsync(fa => fa.TransactionId == txnId);
            Assert.Equal(1, alertCount); // Only one alert exists in database
        }
    }
}
