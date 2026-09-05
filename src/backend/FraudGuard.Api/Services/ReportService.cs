using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Reports;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public interface IReportService
    {
        Task<PagedResult<ReportDto>> GetReportsAsync(string? category, string? riskLevel, int page, int pageSize);
        Task<ReportDto?> GetReportByIdAsync(Guid id);
        Task<ReportDto> CreateReportAsync(CreateReportDto dto, Guid? userId);
    }

    public class ReportService : IReportService
    {
        private readonly FraudGuardDbContext _db;

        public ReportService(FraudGuardDbContext db)
        {
            _db = db;
        }

        public async Task<PagedResult<ReportDto>> GetReportsAsync(string? category, string? riskLevel, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Reports
                .Include(r => r.Customer)
                .Include(r => r.GeneratedByUser)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(riskLevel) && !riskLevel.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.RiskLevel == riskLevel);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new ReportDto
                {
                    ReportId = r.ReportId,
                    ReportCode = r.ReportCode,
                    InvestigationId = r.InvestigationId,
                    TransactionId = r.TransactionId,
                    EntityCode = r.Customer != null ? r.Customer.CustomerCode : "",
                    EntityName = r.Customer != null ? r.Customer.FullName : "",
                    Title = r.ReportTitle,
                    RiskLevel = r.RiskLevel,
                    GeneratedBy = r.GeneratedByUser != null ? r.GeneratedByUser.FullName : (r.IsAiGenerated ? "AI Agent Synthesizer" : "Compliance Officer"),
                    IsAiGenerated = r.IsAiGenerated,
                    DateFormatted = r.CreatedAt.ToString("MMM dd, yyyy"),
                    TimeFormatted = r.CreatedAt.ToString("HH:mm IST"),
                    Status = r.Status,
                    Category = r.Category,
                    Summary = r.Summary,
                    Narrative = r.Narrative,
                    FindingsCount = r.FindingsCount
                })
                .ToListAsync();

            return new PagedResult<ReportDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<ReportDto?> GetReportByIdAsync(Guid id)
        {
            var r = await _db.Reports
                .Include(x => x.Customer)
                .Include(x => x.GeneratedByUser)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ReportId == id);

            if (r == null) return null;

            return new ReportDto
            {
                ReportId = r.ReportId,
                ReportCode = r.ReportCode,
                InvestigationId = r.InvestigationId,
                TransactionId = r.TransactionId,
                EntityCode = r.Customer != null ? r.Customer.CustomerCode : "",
                EntityName = r.Customer != null ? r.Customer.FullName : "",
                Title = r.ReportTitle,
                RiskLevel = r.RiskLevel,
                GeneratedBy = r.GeneratedByUser != null ? r.GeneratedByUser.FullName : (r.IsAiGenerated ? "AI Agent Synthesizer" : "Compliance Officer"),
                IsAiGenerated = r.IsAiGenerated,
                DateFormatted = r.CreatedAt.ToString("MMM dd, yyyy"),
                TimeFormatted = r.CreatedAt.ToString("HH:mm IST"),
                Status = r.Status,
                Category = r.Category,
                Summary = r.Summary,
                Narrative = r.Narrative,
                FindingsCount = r.FindingsCount
            };
        }

        public async Task<ReportDto> CreateReportAsync(CreateReportDto dto, Guid? userId)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var code = $"RPT-2026-{(timestamp % 9000 + 1000):D4}";

            var entity = new Report
            {
                ReportCode = code,
                CustomerId = dto.CustomerId,
                InvestigationId = dto.InvestigationId,
                TransactionId = dto.TransactionId,
                ReportTitle = dto.ReportTitle,
                Category = dto.Category,
                RiskLevel = dto.RiskLevel,
                GeneratedByUserId = userId,
                IsAiGenerated = true,
                Status = "Draft",
                Summary = dto.Summary,
                Narrative = dto.Narrative,
                FindingsCount = 4,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _db.Reports.Add(entity);
            await _db.SaveChangesAsync();

            return (await GetReportByIdAsync(entity.ReportId))!;
        }
    }
}
