using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models
{
    public class Customer
    {
        public Guid CustomerId { get; set; } = Guid.NewGuid();
        
        [MaxLength(50)]
        public string CustomerCode { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string CustomerType { get; set; } = "INDIVIDUAL"; // INDIVIDUAL, CORPORATE
        
        [MaxLength(200)]
        public string FullName { get; set; } = string.Empty;
        
        [MaxLength(256)]
        public string Email { get; set; } = string.Empty;
        
        [MaxLength(20)]
        public string? Phone { get; set; }
        
        [MaxLength(500)]
        public string? AddressLine { get; set; }
        
        [MaxLength(100)]
        public string City { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string? State { get; set; }
        
        [MaxLength(100)]
        public string Country { get; set; } = "India";
        
        [MaxLength(20)]
        public string? PostalCode { get; set; }
        
        [MaxLength(20)]
        public string? PAN { get; set; }
        
        [MaxLength(20)]
        public string? AadhaarMasked { get; set; }
        
        [MaxLength(50)]
        public string KYCStatus { get; set; } = "Pending"; // Verified, Pending, Failed, Expired
        
        public int CustomerSinceYear { get; set; } = DateTime.UtcNow.Year;
        public int AccountAgeMonths { get; set; }
        public decimal BaselineAvgAmount { get; set; }
        public decimal Rolling30dVolume { get; set; }
        public decimal RiskScore { get; set; }
        
        [MaxLength(50)]
        public string RiskTier { get; set; } = "Low"; // Critical, High, Medium, Low
        
        [MaxLength(50)]
        public string Status { get; set; } = "Active"; // Active, Under Review, Suspended, Closed
        
        public int PriorFlagsCount { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<Account> Accounts { get; set; } = new List<Account>();
        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
        public ICollection<CustomerDevice> CustomerDevices { get; set; } = new List<CustomerDevice>();
        public ICollection<FraudAlert> FraudAlerts { get; set; } = new List<FraudAlert>();
        public ICollection<Investigation> Investigations { get; set; } = new List<Investigation>();
        public ICollection<Report> Reports { get; set; } = new List<Report>();
    }
}
