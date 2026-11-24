using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.Fraud;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Persists why a transaction was scored the way it was (calibrated probability and the top feature attributions
    /// at scoring time) in <c>FraudPredictions.TopRiskDriversJson</c>, so the explanation is part of the audit trail
    /// and does not depend on re-scoring with a model that may have changed since.
    /// </summary>
    public static class PredictionExplanationStore
    {
        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private sealed class Stored
        {
            public decimal? CalibratedProbability { get; set; }
            public decimal? BaseValue { get; set; }
            public List<FactorContributionDto>? TopFactors { get; set; }
        }

        /// <summary>Returns null when the engine supplied neither a calibrated probability nor attributions.</summary>
        public static string? Serialize(FastApiPredictionResponse response)
        {
            if (response.CalibratedProbability == null && (response.TopFactors == null || response.TopFactors.Count == 0))
                return null;

            return JsonSerializer.Serialize(new Stored
            {
                CalibratedProbability = response.CalibratedProbability,
                BaseValue = response.BaseValue,
                TopFactors = response.TopFactors?
                    .Select(f => new FactorContributionDto { Feature = f.Feature, Value = f.Value, Contribution = f.Contribution })
                    .ToList()
            }, Options);
        }

        /// <summary>Never throws: old rows may hold other content in this column, and a bad row must not break a page.</summary>
        public static (decimal? CalibratedProbability, List<FactorContributionDto>? TopFactors) TryParse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return (null, null);
            try
            {
                var stored = JsonSerializer.Deserialize<Stored>(json, Options);
                var factors = stored?.TopFactors is { Count: > 0 } f ? f : null;
                return (stored?.CalibratedProbability, factors);
            }
            catch (JsonException)
            {
                return (null, null);
            }
        }
    }
}
