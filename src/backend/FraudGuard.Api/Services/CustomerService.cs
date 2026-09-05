using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Customers;
using FraudGuard.Api.DTOs.Transactions;
using FraudGuard.Api.DTOs.FraudAlerts;

namespace FraudGuard.Api.Services
{
    public interface ICustomerService
    {
        Task<PagedResult<CustomerDto>> GetCustomersAsync(string? search, string? riskTier, int page, int pageSize);
        Task<CustomerDetailDto?> GetCustomerByIdAsync(Guid id);
        Task<List<TransactionDto>> GetCustomerTransactionsAsync(Guid customerId);
        Task<List<FraudAlertDto>> GetCustomerAlertsAsync(Guid customerId);
    }

    public class CustomerService : ICustomerService
    {
        private readonly FraudGuardDbContext _db;

        public CustomerService(FraudGuardDbContext db)
        {
            _db = db;
        }

        public async Task<PagedResult<CustomerDto>> GetCustomersAsync(string? search, string? riskTier, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Customers
                .Include(c => c.CustomerDevices)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim().ToLower();
                query = query.Where(c => c.FullName.ToLower().Contains(q) ||
                                         c.CustomerCode.ToLower().Contains(q) ||
                                         c.Email.ToLower().Contains(q) ||
                                         c.City.ToLower().Contains(q));
            }

            if (!string.IsNullOrWhiteSpace(riskTier) && !riskTier.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(c => c.RiskTier == riskTier);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(c => c.RiskScore)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CustomerDto
                {
                    CustomerId = c.CustomerId,
                    CustomerCode = c.CustomerCode,
                    CustomerType = c.CustomerType,
                    FullName = c.FullName,
                    Email = c.Email,
                    Phone = c.Phone,
                    City = c.City,
                    Country = c.Country,
                    PAN = c.PAN,
                    KYCStatus = c.KYCStatus,
                    CustomerSinceYear = c.CustomerSinceYear,
                    AccountAgeMonths = c.AccountAgeMonths,
                    BaselineAvgAmount = c.BaselineAvgAmount,
                    Rolling30dVolume = c.Rolling30dVolume,
                    RiskScore = c.RiskScore,
                    RiskTier = c.RiskTier,
                    Status = c.Status,
                    PriorFlagsCount = c.PriorFlagsCount,
                    KnownDevicesCount = c.CustomerDevices.Count,
                    Initials = c.FullName.Length >= 2 ? (c.FullName.Substring(0, 1) + c.FullName.Substring(c.FullName.IndexOf(' ') > 0 ? c.FullName.IndexOf(' ') + 1 : 1, 1)).ToUpper() : "CUS"
                })
                .ToListAsync();

            return new PagedResult<CustomerDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<CustomerDetailDto?> GetCustomerByIdAsync(Guid id)
        {
            var c = await _db.Customers
                .Include(x => x.Accounts)
                .Include(x => x.CustomerDevices)
                    .ThenInclude(cd => cd.Device)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CustomerId == id);

            if (c == null) return null;

            return new CustomerDetailDto
            {
                CustomerId = c.CustomerId,
                CustomerCode = c.CustomerCode,
                CustomerType = c.CustomerType,
                FullName = c.FullName,
                Email = c.Email,
                Phone = c.Phone,
                City = c.City,
                Country = c.Country,
                PAN = c.PAN,
                KYCStatus = c.KYCStatus,
                CustomerSinceYear = c.CustomerSinceYear,
                AccountAgeMonths = c.AccountAgeMonths,
                BaselineAvgAmount = c.BaselineAvgAmount,
                Rolling30dVolume = c.Rolling30dVolume,
                RiskScore = c.RiskScore,
                RiskTier = c.RiskTier,
                Status = c.Status,
                PriorFlagsCount = c.PriorFlagsCount,
                KnownDevicesCount = c.CustomerDevices.Count,
                Initials = c.FullName.Length >= 2 ? (c.FullName.Substring(0, 1) + c.FullName.Substring(c.FullName.IndexOf(' ') > 0 ? c.FullName.IndexOf(' ') + 1 : 1, 1)).ToUpper() : "CUS",
                Accounts = c.Accounts.Select(a => new CustomerAccountDto
                {
                    AccountId = a.AccountId,
                    AccountNumber = a.AccountNumber,
                    AccountType = a.AccountType,
                    CurrentBalance = a.CurrentBalance,
                    Status = a.Status
                }).ToList(),
                Devices = c.CustomerDevices.Select(cd => new CustomerDeviceDto
                {
                    DeviceId = cd.DeviceId,
                    DeviceType = cd.Device?.DeviceType ?? "Unknown",
                    OperatingSystem = cd.Device?.OperatingSystem ?? "Unknown",
                    IsRootedOrJailbroken = cd.Device?.IsRootedOrJailbroken ?? false,
                    IsTrusted = cd.IsTrusted,
                    FirstSeenAt = cd.FirstLinkedAt
                }).ToList()
            };
        }

        public async Task<List<TransactionDto>> GetCustomerTransactionsAsync(Guid customerId)
        {
            return await _db.Transactions
                .Include(t => t.Customer)
                .Include(t => t.Merchant)
                .Include(t => t.Device)
                .Include(t => t.FraudPrediction)
                .Where(t => t.CustomerId == customerId)
                .OrderByDescending(t => t.TransactionTimestamp)
                .Select(t => new TransactionDto
                {
                    TransactionId = t.TransactionId,
                    TransactionCode = t.TransactionCode,
                    CustomerId = t.CustomerId,
                    CustomerName = t.Customer != null ? t.Customer.FullName : "",
                    CustomerCode = t.Customer != null ? t.Customer.CustomerCode : "",
                    AmountInr = t.AmountInr,
                    AmountUsd = t.AmountUsd,
                    PaymentMethod = t.PaymentMethod,
                    CardLast4 = t.CardLast4,
                    MerchantName = t.Merchant != null ? t.Merchant.MerchantName : "Unknown",
                    MerchantCategory = t.Merchant != null ? t.Merchant.Category : "Retail",
                    MCC = t.Merchant != null ? t.Merchant.MCC : null,
                    Location = t.City + ", " + t.Country,
                    City = t.City,
                    Country = t.Country,
                    DistanceFromTypical = t.DistanceFromTypicalKm.HasValue ? $"{t.DistanceFromTypicalKm.Value:F0} km" : "< 5 km",
                    Device = t.Device != null ? t.Device.DeviceType + " (" + t.Device.OperatingSystem + ")" : "Unknown",
                    IPAddress = t.IPAddress,
                    VpnDetected = t.VPNOrProxyDetected,
                    Probability = t.FraudPrediction != null ? t.FraudPrediction.FraudProbability : 0,
                    RiskTier = t.FraudPrediction != null ? t.FraudPrediction.RiskTier : "Low",
                    Status = t.Status,
                    AnomalyReason = t.FraudPrediction != null ? t.FraudPrediction.AnomalyReason : "Routine transaction",
                    FormattedDate = t.TransactionTimestamp.ToString("MMM dd, yyyy"),
                    FormattedTime = t.TransactionTimestamp.ToString("HH:mm:ss IST"),
                    Timestamp = t.TransactionTimestamp
                })
                .ToListAsync();
        }

        public async Task<List<FraudAlertDto>> GetCustomerAlertsAsync(Guid customerId)
        {
            return await _db.FraudAlerts
                .Include(fa => fa.Customer)
                .Include(fa => fa.Transaction)
                .Include(fa => fa.AssignedToUser)
                .Where(fa => fa.CustomerId == customerId)
                .OrderByDescending(fa => fa.CreatedAt)
                .Select(fa => new FraudAlertDto
                {
                    AlertId = fa.AlertId,
                    AlertCode = fa.AlertCode,
                    TransactionId = fa.TransactionId,
                    TransactionCode = fa.Transaction != null ? fa.Transaction.TransactionCode : "",
                    CustomerId = fa.CustomerId,
                    CustomerName = fa.Customer != null ? fa.Customer.FullName : "",
                    AmountInr = fa.Transaction != null ? fa.Transaction.AmountInr : 0,
                    FraudProbability = fa.Transaction != null && fa.Transaction.FraudPrediction != null ? fa.Transaction.FraudPrediction.FraudProbability : 0,
                    RiskTier = fa.Severity,
                    Severity = fa.Severity,
                    Reason = fa.Reason,
                    Status = fa.Status,
                    AssignedTo = fa.AssignedToUser != null ? fa.AssignedToUser.FullName : null,
                    Location = fa.Transaction != null ? fa.Transaction.City + ", " + fa.Transaction.Country : "",
                    AlertType = fa.AlertType,
                    CreatedAt = fa.CreatedAt,
                    CreatedDateFormatted = fa.CreatedAt.ToString("MMM dd, yyyy"),
                    CreatedTimeFormatted = fa.CreatedAt.ToString("HH:mm IST")
                })
                .ToListAsync();
        }
    }
}
