using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    /// <summary>The dashboard drift label must come from measured PSI and never claim stability it did not measure.</summary>
    public class ModelMonitoringDriftTests
    {
        private static async Task<(string status, string explanation, int latency)> Monitor(FastApiDriftResponse? drift)
        {
            var engine = new Mock<IFastApiClient>();
            engine.Setup(c => c.GetDriftAsync(It.IsAny<CancellationToken>())).ReturnsAsync(drift);
            engine.Setup(c => c.GetModelInfoAsync(It.IsAny<CancellationToken>())).ReturnsAsync((FastApiModelInfoResponse?)null);
            var db = new FraudGuardDbContext(new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase($"drift_{Guid.NewGuid()}").Options);
            var svc = new AnalyticsService(db, engine.Object, new MemoryCache(new MemoryCacheOptions()),
                new Mock<ILogger<AnalyticsService>>().Object);
            var m = await svc.GetModelMonitoringAsync();
            return (m.DriftStatus, m.DriftExplanation, m.AverageInferenceLatencyMs);
        }

        [Fact]
        public async Task EngineUnreachable_IsReportedAsUnavailable_NotStable()
        {
            var (status, explanation, _) = await Monitor(null);
            Assert.Equal("UNAVAILABLE", status);
            Assert.Contains("could not be reached", explanation);
        }

        [Fact]
        public async Task TooFewSamples_IsInsufficientData_WithTheCounts()
        {
            var (status, explanation, _) = await Monitor(new FastApiDriftResponse { Status = "insufficient_data", NSamples = 37, MinSamples = 200 });
            Assert.Equal("INSUFFICIENT_DATA", status);
            Assert.Contains("200", explanation);
            Assert.Contains("37", explanation);
        }

        [Theory]
        [InlineData("stable", "STABLE")]
        [InlineData("moderate", "MODERATE")]
        [InlineData("significant", "SIGNIFICANT")]
        public async Task MeasuredStatus_IsPassedThrough_WithMaxPsiAndTopFeatures(string engineStatus, string expected)
        {
            var report = new FastApiDriftResponse
            {
                Status = engineStatus, NSamples = 512, MinSamples = 200, Window = 2000, MaxPsi = 0.3141,
                Features = new List<FastApiDriftFeature>
                {
                    new() { Feature = "TransactionAmt", Psi = 0.3141, Status = engineStatus },
                    new() { Feature = "C13", Psi = 0.12, Status = "moderate" }
                }
            };
            var (status, explanation, _) = await Monitor(report);
            Assert.Equal(expected, status);
            Assert.Contains("0.314", explanation);
            Assert.Contains("TransactionAmt", explanation);
            Assert.Contains("512", explanation);
        }

        [Fact]
        public async Task NoPredictionsYet_DoesNotInventALatency()
        {
            var (_, _, latency) = await Monitor(new FastApiDriftResponse { Status = "stable", NSamples = 300, MinSamples = 200, MaxPsi = 0.01 });
            Assert.Equal(0, latency);   // used to be a fabricated 24 ms
        }
    }
}
