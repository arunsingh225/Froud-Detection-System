using System;
using System.Collections.Generic;

namespace FraudGuard.Api.Models
{
    public class Merchant
    {
        public Guid MerchantId { get; set; } = Guid.NewGuid();
        public string MerchantCode { get; set; } = string.Empty;
        public string MerchantName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string MCC { get; set; } = string.Empty;
        public string Country { get; set; } = "India";
        public string? City { get; set; }
        public string RiskCategory { get; set; } = "Standard"; // Elevated, High, Standard, Low
        public bool IsVASP { get; set; } = false;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    }
}
