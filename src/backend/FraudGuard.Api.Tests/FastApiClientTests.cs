using System;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class FastApiClientTests
    {
        private readonly Mock<ILogger<FastApiClient>> _loggerMock = new();

        [Fact]
        public async Task GetHealthAsync_WhenFastApiHealthy_ReturnsHealthResponse()
        {
            // Arrange
            var responsePayload = new FastApiHealthResponse
            {
                Status = "healthy",
                Service = "FraudGuard AI Engine",
                ModelLoaded = true,
                Timestamp = "2026-09-03T12:00:00Z"
            };

            var handlerMock = CreateMockHttpMessageHandler(HttpStatusCode.OK, responsePayload);
            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            // Act
            var result = await client.GetHealthAsync();

            // Assert
            Assert.NotNull(result);
            Assert.Equal("healthy", result.Status);
            Assert.True(result.ModelLoaded);
        }

        [Fact]
        public async Task GetHealthAsync_WhenFastApiUnavailable_ReturnsNullWithoutThrowing()
        {
            // Arrange
            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ThrowsAsync(new HttpRequestException("Connection refused"));

            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            // Act
            var result = await client.GetHealthAsync();

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task GetModelInfoAsync_WhenSuccess_ReturnsModelMetadata()
        {
            // Arrange
            var responsePayload = new FastApiModelInfoResponse
            {
                ModelName = "LightGBM_Fraud_Classifier",
                ModelVersion = "1.0",
                RocAuc = 0.9168m,
                PrAuc = 0.5393m,
                Threshold = 0.80m,
                FeatureCount = 464
            };

            var handlerMock = CreateMockHttpMessageHandler(HttpStatusCode.OK, responsePayload);
            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            // Act
            var result = await client.GetModelInfoAsync();

            // Assert
            Assert.NotNull(result);
            Assert.Equal("LightGBM_Fraud_Classifier", result.ModelName);
            Assert.Equal(464, result.FeatureCount);
            Assert.Equal(0.80m, result.Threshold);
        }

        [Fact]
        public async Task PredictAsync_WhenValidRequest_ReturnsPredictionResponse()
        {
            // Arrange
            var responsePayload = new FastApiPredictionResponse
            {
                RequestId = Guid.NewGuid().ToString(),
                FraudProbability = 0.8412m,
                RiskLevel = "CRITICAL",
                IsFraud = true,
                Threshold = 0.80m,
                ModelName = "LightGBM_Fraud_Classifier",
                ModelVersion = "1.0",
                PredictionTimestamp = DateTime.UtcNow.ToString("O")
            };

            var handlerMock = CreateMockHttpMessageHandler(HttpStatusCode.OK, responsePayload);
            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            var request = new FastApiPredictionRequest
            {
                TransactionAmt = 250.50m,
                ProductCD = "W"
            };

            // Act
            var result = await client.PredictAsync(request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(0.8412m, result.FraudProbability);
            Assert.Equal("CRITICAL", result.RiskLevel);
            Assert.True(result.IsFraud);
            Assert.NotEmpty(result.RequestId);
        }

        [Fact]
        public async Task PredictAsync_WhenValidationError_ThrowsArgumentExceptionWithoutRetrying()
        {
            // Arrange
            var handlerMock = new Mock<HttpMessageHandler>();
            int calls = 0;
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .Callback(() => calls++)
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.UnprocessableEntity)
                {
                    Content = new StringContent("{\"error\":\"TransactionAmt must be > 0\"}")
                });

            var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost:8000") };
            var client = new FastApiClient(httpClient, _loggerMock.Object);

            var request = new FastApiPredictionRequest { TransactionAmt = -50m };

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(() => client.PredictAsync(request));
            Assert.Equal(1, calls); // Must NOT retry 4xx errors
        }

        private static Mock<HttpMessageHandler> CreateMockHttpMessageHandler<T>(HttpStatusCode statusCode, T content)
        {
            var handlerMock = new Mock<HttpMessageHandler>();
            var response = new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(JsonSerializer.Serialize(content), System.Text.Encoding.UTF8, "application/json")
            };

            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(response);

            return handlerMock;
        }
    }
}
