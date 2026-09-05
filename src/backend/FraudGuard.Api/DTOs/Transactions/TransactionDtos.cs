using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.Transactions
{
    public class TransactionDto
    {
        public Guid TransactionId { get; set; }
        public string TransactionCode { get; set; } = string.Empty;
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerCode { get; set; } = string.Empty;
        public decimal AmountInr { get; set; }
        public decimal? AmountUsd { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public string? CardLast4 { get; set; }
        public string MerchantName { get; set; } = string.Empty;
        public string MerchantCategory { get; set; } = string.Empty;
        public string? MCC { get; set; }
        public string Location { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string DistanceFromTypical { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public string IPAddress { get; set; } = string.Empty;
        public bool VpnDetected { get; set; }
        public decimal Probability { get; set; }
        public string RiskTier { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string AnomalyReason { get; set; } = string.Empty;
        public string FormattedDate { get; set; } = string.Empty;
        public string FormattedTime { get; set; } = string.Empty;
        public DateTimeOffset Timestamp { get; set; }
    }

    public class CreateTransactionDto
    {
        [Required]
        public Guid AccountId { get; set; }

        [Required]
        public Guid CustomerId { get; set; }

        public Guid? MerchantId { get; set; }
        public Guid? DeviceId { get; set; }

        [Range(1.0, 100000000.0)]
        public decimal AmountInr { get; set; }

        public decimal? AmountUsd { get; set; }

        [Required]
        public string PaymentMethod { get; set; } = string.Empty;

        public string? CardLast4 { get; set; }

        [Required]
        public string IPAddress { get; set; } = string.Empty;

        [Required]
        public string City { get; set; } = string.Empty;

        [Required]
        public string Country { get; set; } = "India";

        public decimal? DistanceFromTypicalKm { get; set; }
        public bool VPNOrProxyDetected { get; set; }
    }

    public class UpdateTransactionStatusDto
    {
        [Required]
        public string Status { get; set; } = string.Empty; // Approved, Rejected, Escalated, Pending Review
    }
}
