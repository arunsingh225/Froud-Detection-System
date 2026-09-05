using System.Threading;
using System.Threading.Tasks;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.AIInvestigator;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Contract for communicating with the internal FastAPI AI Fraud Inference Engine.
    /// </summary>
    public interface IFastApiClient
    {
        Task<FastApiHealthResponse?> GetHealthAsync(CancellationToken cancellationToken = default);
        Task<FastApiModelInfoResponse?> GetModelInfoAsync(CancellationToken cancellationToken = default);
        Task<FastApiPredictionResponse> PredictAsync(FastApiPredictionRequest request, CancellationToken cancellationToken = default);
        Task<InvestigationResultDto> InvestigateAsync(FastApiInvestigationRequest request, CancellationToken cancellationToken = default);
    }
}
