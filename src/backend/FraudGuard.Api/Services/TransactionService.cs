using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Transactions;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public interface ITransactionService
    {
        Task<PagedResult<TransactionDto>> GetTransactionsAsync(string? search, string? riskTier, string? status, int page, int pageSize);
        Task<TransactionDto?> GetTransactionByIdAsync(Guid id);
        Task<TransactionDto> CreateTransactionAsync(CreateTransactionDto dto);
        Task<bool> UpdateStatusAsync(Guid id, string newStatus);
    }

    public class TransactionService : ITransactionService
    {
        private readonly FraudGuardDbContext _db;
        private readonly IFraudPredictionService _fraudPredictionService;

        public TransactionService(FraudGuardDbContext db, IFraudPredictionService fraudPredictionService)
        {
            _db = db;
            _fraudPredictionService = fraudPredictionService;
        }

        public async Task<PagedResult<TransactionDto>> GetTransactionsAsync(string? search, string? riskTier, string? status, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Transactions
                .Include(t => t.Customer)
                .Include(t => t.Merchant)
                .Include(t => t.Device)
                .Include(t => t.FraudPrediction)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim().ToLower();
                query = query.Where(t => t.TransactionCode.ToLower().Contains(q) ||
                                         (t.Customer != null && t.Customer.FullName.ToLower().Contains(q)) ||
                                         (t.Customer != null && t.Customer.CustomerCode.ToLower().Contains(q)) ||
                                         (t.Merchant != null && t.Merchant.MerchantName.ToLower().Contains(q)) ||
                                         t.City.ToLower().Contains(q));
            }

            if (!string.IsNullOrWhiteSpace(riskTier) && !riskTier.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(t => t.FraudPrediction != null && t.FraudPrediction.RiskTier == riskTier);
            }

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(t => t.Status == status);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(t => t.TransactionTimestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
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
                    DistanceFromTypical = t.DistanceFromTypicalKm.HasValue ? $"{t.DistanceFromTypicalKm.Value:F0} km from home" : "< 5 km from home",
                    Device = t.Device != null ? t.Device.DeviceType + " / " + t.Device.OperatingSystem : "Unknown Device",
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

            return new PagedResult<TransactionDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<TransactionDto?> GetTransactionByIdAsync(Guid id)
        {
            var t = await _db.Transactions
                .Include(x => x.Customer)
                .Include(x => x.Merchant)
                .Include(x => x.Device)
                .Include(x => x.FraudPrediction)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.TransactionId == id);

            if (t == null) return null;

            return new TransactionDto
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
                DistanceFromTypical = t.DistanceFromTypicalKm.HasValue ? $"{t.DistanceFromTypicalKm.Value:F0} km from home" : "< 5 km from home",
                Device = t.Device != null ? t.Device.DeviceType + " / " + t.Device.OperatingSystem : "Unknown Device",
                IPAddress = t.IPAddress,
                VpnDetected = t.VPNOrProxyDetected,
                Probability = t.FraudPrediction != null ? t.FraudPrediction.FraudProbability : 0,
                RiskTier = t.FraudPrediction != null ? t.FraudPrediction.RiskTier : "Low",
                Status = t.Status,
                AnomalyReason = t.FraudPrediction != null ? t.FraudPrediction.AnomalyReason : "Routine transaction",
                FormattedDate = t.TransactionTimestamp.ToString("MMM dd, yyyy"),
                FormattedTime = t.TransactionTimestamp.ToString("HH:mm:ss IST"),
                Timestamp = t.TransactionTimestamp
            };
        }

        public async Task<TransactionDto> CreateTransactionAsync(CreateTransactionDto dto)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var code = $"TXN-2026-{(timestamp % 900000 + 100000):D6}";

            var entity = new Transaction
            {
                TransactionCode = code,
                AccountId = dto.AccountId,
                CustomerId = dto.CustomerId,
                MerchantId = dto.MerchantId,
                DeviceId = dto.DeviceId,
                AmountInr = dto.AmountInr,
                AmountUsd = dto.AmountUsd ?? Math.Round(dto.AmountInr / 83.5m, 2),
                PaymentMethod = dto.PaymentMethod,
                CardLast4 = dto.CardLast4,
                IPAddress = dto.IPAddress,
                City = dto.City,
                Country = dto.Country,
                DistanceFromTypicalKm = dto.DistanceFromTypicalKm ?? 5.0m,
                VPNOrProxyDetected = dto.VPNOrProxyDetected,
                TransactionTimestamp = DateTimeOffset.UtcNow,
                Status = "Pending Review"
            };

            _db.Transactions.Add(entity);
            await _db.SaveChangesAsync();

            // Perform real-time fraud assessment via FastAPI AI Engine
            try
            {
                await _fraudPredictionService.PredictAndProcessAsync(entity.TransactionId);
            }
            catch (Exception)
            {
                // Non-blocking: transaction persistence succeeds even if AI engine is temporarily unreachable
                // Seed a default pending prediction if not already present
                if (!_db.FraudPredictions.Any(fp => fp.TransactionId == entity.TransactionId))
                {
                    var prob = dto.VPNOrProxyDetected || dto.AmountInr > 500000 ? 84.5m : 12.0m;
                    var tier = prob > 90 ? "Critical" : (prob > 70 ? "High" : (prob > 30 ? "Medium" : "Low"));

                    var pred = new FraudPrediction
                    {
                        TransactionId = entity.TransactionId,
                        ModelName = "LightGBM_Fraud_Classifier (Offline)",
                        ModelVersion = "1.0",
                        FraudProbability = prob,
                        RiskTier = tier,
                        InferenceLatencyMs = 0,
                        AnomalyReason = "Initial baseline assessment (AI Engine offline fallback)."
                    };
                    _db.FraudPredictions.Add(pred);
                    await _db.SaveChangesAsync();
                }
            }

            return (await GetTransactionByIdAsync(entity.TransactionId))!;
        }

        public async Task<bool> UpdateStatusAsync(Guid id, string newStatus)
        {
            var t = await _db.Transactions.FindAsync(id);
            if (t == null) return false;

            t.Status = newStatus;
            t.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
