using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.FraudAlerts;

namespace FraudGuard.Api.Services
{
    public interface IFraudAlertService
    {
        Task<PagedResult<FraudAlertDto>> GetAlertsAsync(string? status, string? severity, int page, int pageSize);
        Task<FraudAlertDto?> GetAlertByIdAsync(Guid id);
        Task<bool> ResolveAlertAsync(Guid id, string? notes);
        Task<bool> AssignAlertAsync(Guid id, Guid userId);
    }

    public class FraudAlertService : IFraudAlertService
    {
        private readonly FraudGuardDbContext _db;

        public FraudAlertService(FraudGuardDbContext db)
        {
            _db = db;
        }

        public async Task<PagedResult<FraudAlertDto>> GetAlertsAsync(string? status, string? severity, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.FraudAlerts
                .Include(fa => fa.Customer)
                .Include(fa => fa.Transaction)
                    .ThenInclude(t => t!.FraudPrediction)
                .Include(fa => fa.AssignedToUser)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(fa => fa.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(severity) && !severity.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(fa => fa.Severity == severity);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(fa => fa.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
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

            return new PagedResult<FraudAlertDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<FraudAlertDto?> GetAlertByIdAsync(Guid id)
        {
            var fa = await _db.FraudAlerts
                .Include(x => x.Customer)
                .Include(x => x.Transaction)
                    .ThenInclude(t => t!.FraudPrediction)
                .Include(x => x.AssignedToUser)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.AlertId == id);

            if (fa == null) return null;

            return new FraudAlertDto
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
            };
        }

        public async Task<bool> ResolveAlertAsync(Guid id, string? notes)
        {
            var alert = await _db.FraudAlerts.FindAsync(id);
            if (alert == null) return false;

            alert.Status = "Resolved";
            alert.ResolvedAt = DateTimeOffset.UtcNow;
            alert.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AssignAlertAsync(Guid id, Guid userId)
        {
            var alert = await _db.FraudAlerts.FindAsync(id);
            if (alert == null) return false;

            alert.AssignedToUserId = userId;
            alert.Status = "Investigating";
            alert.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
