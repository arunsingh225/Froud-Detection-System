using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class Account
    {
        public Guid AccountId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string AccountCode { get; set; } = string.Empty;
        
        public Guid CustomerId { get; set; }
        
        [MaxLength(50)]
        public string AccountNumber { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string AccountType { get; set; } = "SAVINGS"; // SAVINGS, CURRENT, CREDIT_CARD, VIRTUAL_WALLET, CORPORATE
        
        [MaxLength(30)]
        public string Currency { get; set; } = "INR";
        
        public decimal CurrentBalance { get; set; }
        public decimal DailyLimit { get; set; } = 1000000.00m;
        
        [MaxLength(50)]
        public string Status { get; set; } = "ACTIVE"; // ACTIVE, FLAGGED, RESTRICTED, FROZEN, CLOSED
        
        public DateOnly OpenedDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public Customer? Customer { get; set; }
        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    }
}
