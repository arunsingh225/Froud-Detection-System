using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class PredictionExplanationStoreTests
    {
        private static FastApiPredictionResponse Response(decimal? calibrated = 0.412m, bool withFactors = true) => new()
        {
            FraudProbability = 0.93m, RiskLevel = "CRITICAL", CalibratedProbability = calibrated, BaseValue = -3.2m,
            TopFactors = withFactors
                ? new List<FastApiFactorContribution>
                {
                    new() { Feature = "TransactionAmt", Value = 4999, Contribution = 1.25 },
                    new() { Feature = "C13", Value = null, Contribution = -0.4 }
                }
                : null
        };

        [Fact]
        public void RoundTrip_PreservesCalibratedProbabilityAndFactors_IncludingMissingValues()
        {
            var json = PredictionExplanationStore.Serialize(Response());

            var (calibrated, factors) = PredictionExplanationStore.TryParse(json);

            Assert.Equal(0.412m, calibrated);
            Assert.Equal(2, factors!.Count);
            Assert.Equal("TransactionAmt", factors[0].Feature);
            Assert.Equal(1.25, factors[0].Contribution);
            Assert.Null(factors[1].Value);
        }

        [Fact]
        public void Json_UsesCamelCase_AndOmitsNulls()
        {
            using var doc = JsonDocument.Parse(PredictionExplanationStore.Serialize(Response())!);
            Assert.True(doc.RootElement.TryGetProperty("calibratedProbability", out _));
            Assert.True(doc.RootElement.TryGetProperty("topFactors", out var factors));
            Assert.False(factors[1].TryGetProperty("value", out _));       // null value omitted
        }

        [Fact]
        public void NothingToStore_ReturnsNull()
        {
            Assert.Null(PredictionExplanationStore.Serialize(Response(calibrated: null, withFactors: false)));
        }

        [Fact]
        public void CalibratedOnly_IsStoredWithoutFactors()
        {
            var (calibrated, factors) = PredictionExplanationStore.TryParse(
                PredictionExplanationStore.Serialize(Response(0.07m, withFactors: false)));
            Assert.Equal(0.07m, calibrated);
            Assert.Null(factors);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("not json at all")]
        [InlineData("[1,2,3]")]
        [InlineData("{\"topFactors\": \"oops\"}")]
        public void MalformedOrForeignContent_NeverThrows(string? json)
        {
            var (calibrated, factors) = PredictionExplanationStore.TryParse(json);
            Assert.Null(calibrated);
            Assert.Null(factors);
        }
    }

    public class PredictionExplanationPersistenceTests
    {
        [Fact]
        public async Task Scoring_PersistsTheExplanation_AndTheDetailEndpointReturnsIt()
        {
            var db = new FraudGuardDbContext(new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase($"explain_{Guid.NewGuid()}").Options);
            var customer = new Customer { CustomerId = Guid.NewGuid(), FullName = "A B", Email = "a@b.test" };
            var account = new Account { AccountId = Guid.NewGuid(), CustomerId = customer.CustomerId, AccountNumber = "ACC-1" };
            var txn = new Transaction
            {
                TransactionCode = "TXN-EXPL-1", CustomerId = customer.CustomerId, AccountId = account.AccountId,
                AmountInr = 500000m, PaymentMethod = "Visa Credit", City = "Mumbai", Country = "India", Status = "Pending Review"
            };
            db.AddRange(customer, account, txn);
            await db.SaveChangesAsync();

            var engine = new Mock<IFastApiClient>();
            engine.Setup(c => c.PredictAsync(It.IsAny<FastApiPredictionRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FastApiPredictionResponse
                {
                    FraudProbability = 0.885m, RiskLevel = "CRITICAL", IsFraud = true, ModelName = "m", ModelVersion = "1",
                    CalibratedProbability = 0.33m,
                    TopFactors = new List<FastApiFactorContribution> { new() { Feature = "TransactionAmt", Value = 500000, Contribution = 1.9 } }
                });
            await new FraudPredictionService(db, engine.Object, new FraudPredictionMapper(),
                new Mock<ILogger<FraudPredictionService>>().Object).PredictAndProcessAsync(txn.TransactionId);

            var stored = await db.FraudPredictions.AsNoTracking().SingleAsync(p => p.TransactionId == txn.TransactionId);
            Assert.NotNull(stored.TopRiskDriversJson);

            var detail = await new TransactionService(db, new Mock<IFraudPredictionService>().Object).GetTransactionByIdAsync(txn.TransactionId);
            Assert.Equal(0.33m, detail!.CalibratedProbability);
            Assert.Equal("TransactionAmt", detail.TopFactors![0].Feature);
            Assert.Equal(1.9, detail.TopFactors[0].Contribution);
        }

        [Fact]
        public async Task LegacyRowsWithOtherContentInTheColumn_StillLoad()
        {
            var db = new FraudGuardDbContext(new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase($"legacy_{Guid.NewGuid()}").Options);
            var customer = new Customer { CustomerId = Guid.NewGuid(), FullName = "A B", Email = "a@b.test" };
            var account = new Account { AccountId = Guid.NewGuid(), CustomerId = customer.CustomerId, AccountNumber = "ACC-2" };
            var txn = new Transaction
            {
                TransactionCode = "TXN-LEG-1", CustomerId = customer.CustomerId, AccountId = account.AccountId,
                AmountInr = 1000m, PaymentMethod = "UPI", City = "Pune", Country = "India", Status = "Approved"
            };
            db.AddRange(customer, account, txn);
            db.FraudPredictions.Add(new FraudPrediction
            {
                TransactionId = txn.TransactionId, FraudProbability = 12m, RiskTier = "Low",
                AnomalyReason = "old", TopRiskDriversJson = "[\"velocity\",\"device\"]"      // pre-existing free-form content
            });
            await db.SaveChangesAsync();

            var detail = await new TransactionService(db, new Mock<IFraudPredictionService>().Object).GetTransactionByIdAsync(txn.TransactionId);

            Assert.NotNull(detail);
            Assert.Null(detail!.CalibratedProbability);
            Assert.Null(detail.TopFactors);
        }
    }
}
