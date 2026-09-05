using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class Transaction
    {
        public Guid TransactionId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string TransactionCode { get; set; } = string.Empty;
        
        public Guid AccountId { get; set; }
        public Guid CustomerId { get; set; }
        public Guid? MerchantId { get; set; }
        public Guid? DeviceId { get; set; }
        public decimal AmountInr { get; set; }
        public decimal? AmountUsd { get; set; }
        
        [MaxLength(30)]
        public string PaymentMethod { get; set; } = string.Empty;
        
        [MaxLength(4)]
        public string? CardLast4 { get; set; }
        
        [MaxLength(45)]
        public string IPAddress { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string City { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string Country { get; set; } = string.Empty;
        
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public decimal? DistanceFromTypicalKm { get; set; }
        public bool VPNOrProxyDetected { get; set; }
        public bool TorExitNode { get; set; }
        public DateTimeOffset TransactionTimestamp { get; set; } = DateTimeOffset.UtcNow;
        
        [MaxLength(50)]
        public string Status { get; set; } = "Pending Review"; // Pending Review, Investigating, Escalated, Resolved, Approved, Rejected
        
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public Account? Account { get; set; }
        public Customer? Customer { get; set; }
        public Merchant? Merchant { get; set; }
        public Device? Device { get; set; }
        public FraudPrediction? FraudPrediction { get; set; }
        public ICollection<FraudAlert> FraudAlerts { get; set; } = new List<FraudAlert>();
        public ICollection<Investigation> Investigations { get; set; } = new List<Investigation>();
        public ICollection<Report> Reports { get; set; } = new List<Report>();
    }

    public class FraudPrediction
    {
        public Guid PredictionId { get; set; } = Guid.NewGuid();
        public Guid TransactionId { get; set; }
        
        [MaxLength(100)]
        public string ModelName { get; set; } = "FraudNet v3.1";
        
        [MaxLength(20)]
        public string ModelVersion { get; set; } = "3.1.2";
        
        public decimal FraudProbability { get; set; }
        
        [MaxLength(50)]
        public string RiskTier { get; set; } = "Low"; // Critical, High, Medium, Low
        
        public int InferenceLatencyMs { get; set; } = 24;
        public decimal? VelocityRatio { get; set; }
        
        [MaxLength(4000)]
        public string? TopRiskDriversJson { get; set; }
        
        [MaxLength(2000)]
        public string AnomalyReason { get; set; } = string.Empty;
        
        public DateTimeOffset PredictedAt { get; set; } = DateTimeOffset.UtcNow;

        public Transaction? Transaction { get; set; }
    }
}
