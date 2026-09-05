using System;
using System.Collections.Generic;

namespace FraudGuard.Api.DTOs.Customers
{
    public class CustomerDto
    {
        public Guid CustomerId { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerType { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string City { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string? PAN { get; set; }
        public string KYCStatus { get; set; } = string.Empty;
        public int CustomerSinceYear { get; set; }
        public int AccountAgeMonths { get; set; }
        public decimal BaselineAvgAmount { get; set; }
        public decimal Rolling30dVolume { get; set; }
        public decimal RiskScore { get; set; }
        public string RiskTier { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int PriorFlagsCount { get; set; }
        public int KnownDevicesCount { get; set; }
        public string Initials { get; set; } = string.Empty;
    }

    public class CustomerDetailDto : CustomerDto
    {
        public List<CustomerAccountDto> Accounts { get; set; } = new List<CustomerAccountDto>();
        public List<CustomerDeviceDto> Devices { get; set; } = new List<CustomerDeviceDto>();
    }

    public class CustomerAccountDto
    {
        public Guid AccountId { get; set; }
        public string AccountNumber { get; set; } = string.Empty;
        public string AccountType { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class CustomerDeviceDto
    {
        public Guid DeviceId { get; set; }
        public string DeviceType { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public bool IsRootedOrJailbroken { get; set; }
        public bool IsTrusted { get; set; }
        public DateTimeOffset FirstSeenAt { get; set; }
    }
}
