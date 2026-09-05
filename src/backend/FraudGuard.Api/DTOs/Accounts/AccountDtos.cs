using System;

namespace FraudGuard.Api.DTOs.Accounts
{
    public class AccountDto
    {
        public Guid AccountId { get; set; }
        public string AccountCode { get; set; } = string.Empty;
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public string AccountType { get; set; } = string.Empty;
        public string Currency { get; set; } = "INR";
        public decimal CurrentBalance { get; set; }
        public decimal DailyLimit { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateOnly OpenedDate { get; set; }
    }
}
