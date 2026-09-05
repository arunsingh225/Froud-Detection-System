using System;
using System.Threading;
using System.Threading.Tasks;
using FraudGuard.Api.DTOs.Fraud;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Contract for orchestrating ML fraud predictions, alert generation, and audit trail capture.
    /// </summary>
    public interface IFraudPredictionService
    {
        Task<FraudPredictionResultDto> PredictAndProcessAsync(Guid transactionId, CancellationToken cancellationToken = default);
        Task<FraudPredictionResultDto> PredictDirectAsync(PredictFraudRequestDto dto, CancellationToken cancellationToken = default);
    }
}
