using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.Fraud
{
    /// <summary>
    /// Request payload for scoring a transaction through the ASP.NET Core orchestration layer.
    /// Supports referencing an existing database transaction by ID, or providing standalone transaction parameters.
    /// </summary>
    public class PredictFraudRequestDto
    {
        public Guid? TransactionId { get; set; }

        [Range(0.01, 100000000.0)]
        public decimal? TransactionAmount { get; set; }

        public string? PaymentMethod { get; set; }

        public string? CardLast4 { get; set; }

        public string? City { get; set; }

        public string? Country { get; set; }

        public string? IPAddress { get; set; }

        public bool? VpnDetected { get; set; }

        public decimal? DistanceFromTypicalKm { get; set; }
    }
}
