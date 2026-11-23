using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using FraudGuard.Api.Controllers;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    /// <summary>Calibrated probability, feature attributions and drift flow from the engine to the API contract.</summary>
    public class FastApiEnrichmentTests
    {
        private const string PredictJson = @"{
            ""request_id"":""r-1"",""fraud_probability"":0.93,""risk_level"":""CRITICAL"",""is_fraud"":true,""threshold"":0.8,
            ""model_name"":""LightGBM_Fraud_Classifier"",""model_version"":""1.0"",""prediction_timestamp"":""2026-11-23T10:00:00Z"",
            ""calibrated_probability"":0.41,""base_value"":-3.2,
            ""top_factors"":[{""feature"":""TransactionAmt"",""value"":4999.0,""contribution"":1.25},
                            {""feature"":""C13"",""value"":null,""contribution"":-0.4}]}";

        private static (FastApiClient client, List<HttpRequestMessage> sent) ClientReturning(HttpStatusCode code, string json)
        {
            var sent = new List<HttpRequestMessage>();
            var handler = new Mock<HttpMessageHandler>();
            handler.Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
                .Callback<HttpRequestMessage, CancellationToken>((r, _) => sent.Add(r))
                .ReturnsAsync(() => new HttpResponseMessage(code) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") });
            var http = new HttpClient(handler.Object) { BaseAddress = new Uri("http://localhost:8000") };
            return (new FastApiClient(http, new Mock<ILogger<FastApiClient>>().Object), sent);
        }

        [Fact]
        public async Task Predict_AsksForAttributions_AndDeserialisesCalibratedProbabilityAndFactors()
        {
            var (client, sent) = ClientReturning(HttpStatusCode.OK, PredictJson);

            var result = await client.PredictAsync(new FastApiPredictionRequest { TransactionAmt = 4999m });

            Assert.Equal("/predict", sent[0].RequestUri!.AbsolutePath);
            Assert.Contains("explain=true", sent[0].RequestUri!.Query);
            Assert.Contains("top_k=5", sent[0].RequestUri!.Query);
            Assert.Equal(0.41m, result.CalibratedProbability);
            Assert.Equal(-3.2m, result.BaseValue);
            Assert.Equal(2, result.TopFactors!.Count);
            Assert.Equal("TransactionAmt", result.TopFactors[0].Feature);
            Assert.Equal(1.25, result.TopFactors[0].Contribution);
            Assert.Null(result.TopFactors[1].Value);          // a missing feature value stays null
        }

        [Fact]
        public async Task Predict_StillWorksWithAnOlderEngineThatSendsNoNewFields()
        {
            const string legacy = @"{""request_id"":""r"",""fraud_probability"":0.2,""risk_level"":""LOW"",""is_fraud"":false,
                ""threshold"":0.8,""model_name"":""m"",""model_version"":""1"",""prediction_timestamp"":""t""}";
            var (client, _) = ClientReturning(HttpStatusCode.OK, legacy);

            var result = await client.PredictAsync(new FastApiPredictionRequest { TransactionAmt = 10m });

            Assert.Null(result.CalibratedProbability);
            Assert.Null(result.TopFactors);
        }

        [Fact]
        public async Task GetDrift_DeserialisesTheReport_AndReturnsNullWhenTheEngineFails()
        {
            const string drift = @"{""status"":""significant"",""n_samples"":512,""min_samples"":200,""window"":2000,""max_psi"":0.61,
                ""features"":[{""feature"":""TransactionAmt"",""psi"":0.61,""status"":""significant""}]}";
            var (ok, sent) = ClientReturning(HttpStatusCode.OK, drift);
            var report = await ok.GetDriftAsync();
            Assert.Equal("/model/drift", sent[0].RequestUri!.AbsolutePath);
            Assert.Equal("significant", report!.Status);
            Assert.Equal(512, report.NSamples);
            Assert.Equal("TransactionAmt", report.Features[0].Feature);

            var (failing, _) = ClientReturning(HttpStatusCode.InternalServerError, "{}");
            Assert.Null(await failing.GetDriftAsync());
        }

        [Fact]
        public async Task DirectPrediction_ExposesCalibratedProbabilityAndFactorsInTheApiContract()
        {
            var engine = new Mock<IFastApiClient>();
            engine.Setup(c => c.PredictAsync(It.IsAny<FastApiPredictionRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FastApiPredictionResponse
                {
                    FraudProbability = 0.93m, RiskLevel = "CRITICAL", IsFraud = true, CalibratedProbability = 0.41m,
                    TopFactors = new List<FastApiFactorContribution> { new() { Feature = "TransactionAmt", Value = 4999, Contribution = 1.25 } }
                });
            var db = new FraudGuardDbContext(new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase($"enrich_{Guid.NewGuid()}").Options);
            var service = new FraudPredictionService(db, engine.Object, new FraudPredictionMapper(), new Mock<ILogger<FraudPredictionService>>().Object);

            var result = await service.PredictDirectAsync(new PredictFraudRequestDto { TransactionAmount = 5000m });

            Assert.Equal(0.93m, result.FraudProbability);          // the uncalibrated score keeps driving tiers and decisions
            Assert.Equal(0.41m, result.CalibratedProbability);
            Assert.Equal("TransactionAmt", result.TopFactors![0].Feature);
            Assert.Equal(1.25, result.TopFactors[0].Contribution);
        }

        [Fact]
        public async Task DriftEndpoint_MapsToTheCamelCaseContract_AndReturns503WhenTheEngineIsDown()
        {
            var engine = new Mock<IFastApiClient>();
            engine.SetupSequence(c => c.GetDriftAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FastApiDriftResponse
                {
                    Status = "moderate", NSamples = 300, MinSamples = 200, Window = 2000, MaxPsi = 0.18,
                    Features = new List<FastApiDriftFeature> { new() { Feature = "C13", Psi = 0.18, Status = "moderate" } }
                })
                .ReturnsAsync((FastApiDriftResponse?)null);
            var controller = new FraudController(engine.Object, new Mock<IFraudPredictionService>().Object);

            var ok = Assert.IsType<OkObjectResult>(await controller.GetModelDrift(CancellationToken.None));
            var dto = Assert.IsType<ApiResponse<FraudDriftDto>>(ok.Value).Data!;
            Assert.Equal("moderate", dto.Status);
            Assert.Equal(300, dto.SampleCount);
            Assert.Equal("C13", dto.Features[0].Feature);

            var down = Assert.IsType<ObjectResult>(await controller.GetModelDrift(CancellationToken.None));
            Assert.Equal(503, down.StatusCode);
        }
    }
}
