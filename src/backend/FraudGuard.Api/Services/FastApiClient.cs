using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.AIInvestigator;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// HTTP client implementation for dispatching inference requests to the FastAPI microservice.
    /// Incorporates bounded retries, resilient timeout handling, and structured diagnostics.
    /// </summary>
    public class FastApiClient : IFastApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<FastApiClient> _logger;
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public FastApiClient(HttpClient httpClient, ILogger<FastApiClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<FastApiHealthResponse?> GetHealthAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                var response = await _httpClient.GetAsync("/health", cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("FastAPI health endpoint returned HTTP {StatusCode}", response.StatusCode);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<FastApiHealthResponse>(JsonOptions, cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
            {
                _logger.LogWarning("Unable to connect to FastAPI health endpoint: {Message}", ex.Message);
                return null;
            }
        }

        public async Task<FastApiModelInfoResponse?> GetModelInfoAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                var response = await _httpClient.GetAsync("/model-info", cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("FastAPI model-info endpoint returned HTTP {StatusCode}", response.StatusCode);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<FastApiModelInfoResponse>(JsonOptions, cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
            {
                _logger.LogWarning("Unable to retrieve FastAPI model specifications: {Message}", ex.Message);
                return null;
            }
        }

        public async Task<FastApiPredictionResponse> PredictAsync(FastApiPredictionRequest request, CancellationToken cancellationToken = default)
        {
            const int maxRetries = 2;
            int attempt = 0;

            while (true)
            {
                attempt++;
                try
                {
                    var response = await _httpClient.PostAsJsonAsync("/predict", request, JsonOptions, cancellationToken);

                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadFromJsonAsync<FastApiPredictionResponse>(JsonOptions, cancellationToken);
                        if (result == null)
                        {
                            throw new InvalidOperationException("FastAPI returned an empty prediction response.");
                        }
                        return result;
                    }

                    // Client validation errors (HTTP 4xx) should not be retried
                    if ((int)response.StatusCode >= 400 && (int)response.StatusCode < 500)
                    {
                        var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                        _logger.LogError("FastAPI rejected payload with HTTP {StatusCode}: {ErrorBody}", response.StatusCode, errorBody);
                        throw new ArgumentException($"FastAPI rejected the transaction payload (HTTP {response.StatusCode}): {errorBody}");
                    }

                    // Server errors (HTTP 5xx) can be retried up to limit
                    if (attempt > maxRetries)
                    {
                        var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                        _logger.LogError("FastAPI server error after {Attempts} attempts (HTTP {StatusCode}): {ErrorBody}", attempt, response.StatusCode, errorBody);
                        throw new HttpRequestException($"FastAPI inference service error (HTTP {response.StatusCode}).");
                    }

                    _logger.LogWarning("Transient error from FastAPI (HTTP {StatusCode}). Retrying attempt {Attempt}/{MaxRetries}...", response.StatusCode, attempt, maxRetries);
                    await Task.Delay(200 * attempt, cancellationToken);
                }
                catch (HttpRequestException ex) when (attempt <= maxRetries && !cancellationToken.IsCancellationRequested)
                {
                    _logger.LogWarning("Network connectivity glitch reaching FastAPI: {Message}. Retrying attempt {Attempt}/{MaxRetries}...", ex.Message, attempt, maxRetries);
                    await Task.Delay(200 * attempt, cancellationToken);
                }
                catch (Exception ex) when (ex is not ArgumentException && ex is not OperationCanceledException)
                {
                    if (attempt <= maxRetries && !cancellationToken.IsCancellationRequested)
                    {
                        _logger.LogWarning("Exception dispatching to FastAPI: {Message}. Retrying...", ex.Message);
                        await Task.Delay(200 * attempt, cancellationToken);
                        continue;
                    }

                    _logger.LogError(ex, "Failed to complete prediction request with FastAPI inference engine.");
                    throw new HttpRequestException("Fraud detection engine is currently unavailable or unreachable.", ex);
                }
            }
        }

        public async Task<InvestigationResultDto> InvestigateAsync(FastApiInvestigationRequest request, CancellationToken cancellationToken = default)
        {
            try
            {
                var response = await _httpClient.PostAsJsonAsync("/investigator/analyze", request, JsonOptions, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<InvestigationResultDto>(JsonOptions, cancellationToken);
                    if (result == null)
                    {
                        throw new InvalidOperationException("FastAPI returned an empty investigation response.");
                    }
                    return result;
                }

                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("FastAPI /investigator/analyze rejected request (HTTP {StatusCode}): {ErrorBody}", response.StatusCode, errorBody);
                throw new HttpRequestException($"AI Investigator engine error (HTTP {response.StatusCode}): {errorBody}");
            }
            catch (Exception ex) when (ex is not HttpRequestException && ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Failed to communicate with FastAPI /investigator/analyze endpoint.");
                throw new HttpRequestException("AI Investigator inference engine is currently unavailable.", ex);
            }
        }
    }
}
