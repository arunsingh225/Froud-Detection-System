using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Orchestrates end-to-end fraud scoring by delegating to the FastAPI microservice,
    /// persisting prediction records into SQL Server, generating investigator alerts,
    /// and logging auditable events.
    /// </summary>
    public class FraudPredictionService : IFraudPredictionService
    {
        private readonly FraudGuardDbContext _db;
        private readonly IFastApiClient _fastApiClient;
        private readonly FraudPredictionMapper _mapper;
        private readonly ILogger<FraudPredictionService> _logger;

        public FraudPredictionService(
            FraudGuardDbContext db,
            IFastApiClient fastApiClient,
            FraudPredictionMapper mapper,
            ILogger<FraudPredictionService> logger)
        {
            _db = db;
            _fastApiClient = fastApiClient;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<FraudPredictionResultDto> PredictAndProcessAsync(Guid transactionId, CancellationToken cancellationToken = default)
        {
            // 1. Retrieve transaction with associated domain entities
            var transaction = await _db.Transactions
                .Include(t => t.Customer)
                .Include(t => t.Merchant)
                .Include(t => t.Device)
                .Include(t => t.FraudPrediction)
                .FirstOrDefaultAsync(t => t.TransactionId == transactionId, cancellationToken);

            if (transaction == null)
            {
                throw new ArgumentException($"Transaction with ID '{transactionId}' was not found.");
            }

            // 2. Map domain transaction to ML inference schema
            var fastApiRequest = _mapper.MapToFastApiRequest(transaction);

            // 3. Dispatch to FastAPI microservice
            var fastApiResult = await _fastApiClient.PredictAsync(fastApiRequest, cancellationToken);

            // 4. Save or update FraudPrediction record in SQL Server
            var prediction = transaction.FraudPrediction;

            if (prediction == null)
            {
                prediction = new FraudPrediction
                {
                    TransactionId = transaction.TransactionId
                };
                _db.FraudPredictions.Add(prediction);
            }

            // Update prediction fields
            prediction.ModelName = fastApiResult.ModelName;
            prediction.ModelVersion = fastApiResult.ModelVersion;
            // Store probability as percentage (0.00 to 100.00) matching decimal(5, 2) DB convention
            prediction.FraudProbability = Math.Round(fastApiResult.FraudProbability * 100m, 2);
            prediction.RiskTier = NormalizeRiskTier(fastApiResult.RiskLevel);
            prediction.InferenceLatencyMs = 15;
            prediction.AnomalyReason = $"FastAPI AI Engine scored transaction with {fastApiResult.FraudProbability:P1} probability ({fastApiResult.RiskLevel} Risk).";
            prediction.PredictedAt = DateTimeOffset.UtcNow;

            // 5. Operational Fraud Alert Generation with Idempotency Protection
            bool alertCreated = false;
            Guid? alertId = null;
            string? alertCode = null;

            bool isHighOrCritical = fastApiResult.RiskLevel.Equals("CRITICAL", StringComparison.OrdinalIgnoreCase) ||
                                   fastApiResult.RiskLevel.Equals("HIGH", StringComparison.OrdinalIgnoreCase) ||
                                   fastApiResult.IsFraud;

            if (isHighOrCritical)
            {
                // Prevent duplicate active alerts for the same transaction
                bool hasActiveAlert = await _db.FraudAlerts
                    .AnyAsync(fa => fa.TransactionId == transaction.TransactionId &&
                                    (fa.Status == "Open" || fa.Status == "Investigating"),
                              cancellationToken);

                if (!hasActiveAlert)
                {
                    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    alertCode = $"ALT-2026-{(timestamp % 900000 + 100000):D6}";

                    var alert = new FraudAlert
                    {
                        AlertCode = alertCode,
                        TransactionId = transaction.TransactionId,
                        CustomerId = transaction.CustomerId,
                        Severity = NormalizeRiskTier(fastApiResult.RiskLevel),
                        AlertType = "ML_FRAUD_DETECTION",
                        Reason = $"AI Fraud Detection Engine flagged transaction with {fastApiResult.FraudProbability:P1} probability ({fastApiResult.RiskLevel} Risk).",
                        Status = "Open",
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };

                    _db.FraudAlerts.Add(alert);
                    alertId = alert.AlertId;
                    alertCreated = true;

                    // Update transaction operational status to Investigating
                    transaction.Status = "Investigating";
                    transaction.UpdatedAt = DateTimeOffset.UtcNow;
                }
            }

            // 6. Record Traceable Audit Trail
            var auditLog = new AuditLog
            {
                AuditCode = $"AUD-2026-{(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % 900000 + 100000):D6}",
                ActorType = "AI AGENT",
                ActorName = "FastAPI AI Engine (LightGBM)",
                Action = "FRAUD_PREDICTION",
                SubAction = alertCreated ? "ALERT_CREATED" : (isHighOrCritical ? "ALERT_EXISTS" : "TRANSACTION_CLEARED"),
                ResourceTarget = $"Transaction/{transaction.TransactionId}",
                Result = "SUCCESS",
                Category = "Investigation",
                DetailsJson = JsonSerializer.Serialize(new
                {
                    requestId = fastApiResult.RequestId,
                    fraudProbability = fastApiResult.FraudProbability,
                    riskLevel = fastApiResult.RiskLevel,
                    isFraud = fastApiResult.IsFraud,
                    threshold = fastApiResult.Threshold,
                    alertCreated = alertCreated,
                    alertCode = alertCode
                }),
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.AuditLogs.Add(auditLog);

            // 7. Commit database changes
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Fraud evaluation completed [Txn={TxnCode}, ReqID={ReqId}]: Prob={Prob:P1}, Tier={Tier}, AlertCreated={AlertCreated}",
                transaction.TransactionCode, fastApiResult.RequestId, fastApiResult.FraudProbability, fastApiResult.RiskLevel, alertCreated
            );

            return new FraudPredictionResultDto
            {
                TransactionId = transaction.TransactionId,
                TransactionCode = transaction.TransactionCode,
                FraudProbability = fastApiResult.FraudProbability,
                RiskLevel = fastApiResult.RiskLevel,
                IsFraud = fastApiResult.IsFraud,
                Threshold = fastApiResult.Threshold,
                AlertCreated = alertCreated,
                AlertId = alertId,
                AlertCode = alertCode,
                PredictionId = prediction.PredictionId,
                RequestId = fastApiResult.RequestId,
                ModelName = fastApiResult.ModelName,
                ModelVersion = fastApiResult.ModelVersion,
                AnomalyReason = prediction.AnomalyReason,
                PredictedAt = prediction.PredictedAt
            };
        }

        public async Task<FraudPredictionResultDto> PredictDirectAsync(PredictFraudRequestDto dto, CancellationToken cancellationToken = default)
        {
            if (dto.TransactionId.HasValue)
            {
                return await PredictAndProcessAsync(dto.TransactionId.Value, cancellationToken);
            }

            // Direct standalone prediction without existing database transaction
            var fastApiRequest = _mapper.MapDtoToFastApiRequest(dto);
            var fastApiResult = await _fastApiClient.PredictAsync(fastApiRequest, cancellationToken);

            return new FraudPredictionResultDto
            {
                TransactionId = Guid.Empty,
                TransactionCode = "AD-HOC",
                FraudProbability = fastApiResult.FraudProbability,
                RiskLevel = fastApiResult.RiskLevel,
                IsFraud = fastApiResult.IsFraud,
                Threshold = fastApiResult.Threshold,
                AlertCreated = false,
                PredictionId = Guid.NewGuid(),
                RequestId = fastApiResult.RequestId,
                ModelName = fastApiResult.ModelName,
                ModelVersion = fastApiResult.ModelVersion,
                AnomalyReason = $"Direct inference completed: {fastApiResult.RiskLevel} Risk tier.",
                PredictedAt = DateTimeOffset.UtcNow
            };
        }

        private static string NormalizeRiskTier(string riskLevel)
        {
            if (string.IsNullOrWhiteSpace(riskLevel)) return "Low";
            return char.ToUpper(riskLevel[0]) + riskLevel[1..].ToLowerInvariant();
        }
    }
}
