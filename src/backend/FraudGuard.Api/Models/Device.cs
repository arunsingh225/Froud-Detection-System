using System;
using System.Collections.Generic;

namespace FraudGuard.Api.Models
{
    public class Device
    {
        public Guid DeviceId { get; set; } = Guid.NewGuid();
        public string DeviceFingerprint { get; set; } = string.Empty;
        public string DeviceType { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public string? Browser { get; set; }
        public bool IsRootedOrJailbroken { get; set; }
        public bool IsEmulator { get; set; }
        public DateTimeOffset FirstSeenAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<CustomerDevice> CustomerDevices { get; set; } = new List<CustomerDevice>();
        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    }

    public class CustomerDevice
    {
        public Guid CustomerId { get; set; }
        public Guid DeviceId { get; set; }
        public bool IsTrusted { get; set; } = true;
        public DateTimeOffset FirstLinkedAt { get; set; } = DateTimeOffset.UtcNow;

        public Customer? Customer { get; set; }
        public Device? Device { get; set; }
    }
}
