using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using FraudGuard.Api.DTOs.AIInvestigator;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class AIInvestigatorServiceTests
    {
        private readonly Mock<ILogger<FastApiClient>> _loggerMock = new();

        [Fact]
        public async Task FastApiClient_InvestigateAsync_ParsesStructuredResult()
        {
            // Arrange
            var responsePayload = new InvestigationResultDto
            {
                InvestigationId = "INV-2026-TEST",
                TransactionId = Guid.NewGuid().ToString(),
                RiskTier = "CRITICAL",
                FraudProbability = 94.5m,
                Decision = "FLAGGED",
                Summary = "FACTUAL CONTEXT: Transfer of ₹850,000 initiated. AI REASONING: Extreme amount anomaly and rooted device.",
                RecommendedAction = "HIGH_PRIORITY_INVESTIGATION",
                Confidence = 0.94m,
                Findings = new List<SuspiciousFindingDto>
                {
                    new()
                    {
                        Title = "Extreme Amount Anomaly",
                        Severity = "CRITICAL",
                        Explanation = "Amount is 34x above baseline.",
                        EvidenceIds = new List<string> { "EV-001" }
                    }
                },
                Evidence = new List<EvidenceItemDto>
                {
                    new()
                    {
                        Id = "EV-001",
                        Category = "Transaction",
                        FindingType = "Amount Anomaly",
                        FindingDetail = "Transfer ₹850,000 deviates from baseline ₹25,000.",
                        Confidence = 95.0m,
                        Severity = "critical",
                        Source = "Transactions"
                    }
                },
                PolicyReferences = new List<PolicyCitationDto>
                {
                    new()
                    {
                        Document = "fraud_investigation_sop.md",
                        Section = "Section 2: Velocity Anomaly",
                        ChunkId = "KB-SOP-001",
                        Source = "Fraud Investigation SOP",
                        Excerpt = "Mandatory Tier-2 investigative review required."
                    }
                }
            };

            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.Method == HttpMethod.Post && req.RequestUri!.AbsolutePath.Contains("/investigator/analyze")),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent(JsonSerializer.Serialize(responsePayload), System.Text.Encoding.UTF8, "application/json")
                });

            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            // Act
            var req = new FastApiInvestigationRequest
            {
                TransactionId = Guid.NewGuid().ToString(),
                AmountInr = 850000m
            };
            var result = await client.InvestigateAsync(req);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("CRITICAL", result.RiskTier);
            Assert.Equal("FLAGGED", result.Decision);
            Assert.Equal("HIGH_PRIORITY_INVESTIGATION", result.RecommendedAction);
            Assert.Single(result.Findings);
            Assert.Single(result.Evidence);
            Assert.Single(result.PolicyReferences);
        }

        [Fact]
        public async Task FastApiClient_InvestigateAsync_ThrowsWhenFastApiRejects()
        {
            // Arrange
            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.InternalServerError,
                    Content = new StringContent("Inference service crashed", System.Text.Encoding.UTF8, "application/json")
                });

            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            // Act & Assert
            var req = new FastApiInvestigationRequest { TransactionId = Guid.NewGuid().ToString(), AmountInr = 1000m };
            await Assert.ThrowsAsync<HttpRequestException>(() => client.InvestigateAsync(req));
        }
    }
}
