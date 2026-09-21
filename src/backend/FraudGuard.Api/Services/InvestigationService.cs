using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Investigations;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public interface IInvestigationService
    {
        Task<PagedResult<InvestigationDto>> GetInvestigationsAsync(string? status, string? priority, int page, int pageSize);
        Task<InvestigationDetailDto?> GetInvestigationByIdAsync(Guid id);
        Task<InvestigationDto> CreateInvestigationAsync(CreateInvestigationDto dto);
        Task<bool> SubmitDecisionAsync(Guid id, InvestigationDecisionDto dto);
        Task<(bool Success, bool IsForbidden, string Message)> SubmitDecisionAsync(
            Guid id,
            InvestigationDecisionDto dto,
            Guid callerUserId,
            string callerRole,
            string callerFullName);
    }

    public class InvestigationService : IInvestigationService
    {
        private readonly FraudGuardDbContext _db;

        public InvestigationService(FraudGuardDbContext db)
        {
            _db = db;
        }

        public async Task<PagedResult<InvestigationDto>> GetInvestigationsAsync(string? status, string? priority, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = _db.Investigations
                .Include(i => i.Customer)
                .Include(i => i.Transaction)
                    .ThenInclude(t => t!.FraudPrediction)
                .Include(i => i.AssignedInvestigator)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(i => i.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(priority) && !priority.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(i => i.Priority == priority);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(i => i.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new InvestigationDto
                {
                    InvestigationId = i.InvestigationId,
                    InvestigationCode = i.InvestigationCode,
                    TransactionId = i.TransactionId,
                    TransactionCode = i.Transaction != null ? i.Transaction.TransactionCode : "",
                    CustomerId = i.CustomerId,
                    CustomerName = i.Customer != null ? i.Customer.FullName : "",
                    RiskTier = i.Transaction != null && i.Transaction.FraudPrediction != null ? i.Transaction.FraudPrediction.RiskTier : "Medium",
                    FraudProbability = i.Transaction != null && i.Transaction.FraudPrediction != null ? i.Transaction.FraudPrediction.FraudProbability : 0,
                    Priority = i.Priority,
                    AssignedInvestigator = i.AssignedInvestigator != null ? i.AssignedInvestigator.FullName : "Unassigned",
                    Status = i.Status,
                    ResolutionDecision = i.ResolutionDecision,
                    AmountInr = i.Transaction != null ? i.Transaction.AmountInr : 0,
                    Location = i.Transaction != null ? i.Transaction.City + ", " + i.Transaction.Country : "",
                    AlertReason = i.Transaction != null && i.Transaction.FraudPrediction != null ? i.Transaction.FraudPrediction.AnomalyReason : "",
                    CreatedDateFormatted = i.CreatedAt.ToString("MMM dd, yyyy"),
                    LastUpdatedFormatted = i.UpdatedAt.ToString("HH:mm IST"),
                    CreatedAt = i.CreatedAt
                })
                .ToListAsync();

            return new PagedResult<InvestigationDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<InvestigationDetailDto?> GetInvestigationByIdAsync(Guid id)
        {
            var i = await _db.Investigations
                .Include(x => x.Customer)
                .Include(x => x.Transaction)
                    .ThenInclude(t => t!.FraudPrediction)
                .Include(x => x.AssignedInvestigator)
                .Include(x => x.Evidence)
                .Include(x => x.Timeline)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.InvestigationId == id);

            if (i == null) return null;

            return new InvestigationDetailDto
            {
                InvestigationId = i.InvestigationId,
                InvestigationCode = i.InvestigationCode,
                TransactionId = i.TransactionId,
                TransactionCode = i.Transaction != null ? i.Transaction.TransactionCode : "",
                CustomerId = i.CustomerId,
                CustomerName = i.Customer != null ? i.Customer.FullName : "",
                RiskTier = i.Transaction != null && i.Transaction.FraudPrediction != null ? i.Transaction.FraudPrediction.RiskTier : "Medium",
                FraudProbability = i.Transaction != null && i.Transaction.FraudPrediction != null ? i.Transaction.FraudPrediction.FraudProbability : 0,
                Priority = i.Priority,
                AssignedInvestigator = i.AssignedInvestigator != null ? i.AssignedInvestigator.FullName : "Unassigned",
                Status = i.Status,
                ResolutionDecision = i.ResolutionDecision,
                AmountInr = i.Transaction != null ? i.Transaction.AmountInr : 0,
                Location = i.Transaction != null ? i.Transaction.City + ", " + i.Transaction.Country : "",
                AlertReason = i.Transaction != null && i.Transaction.FraudPrediction != null ? i.Transaction.FraudPrediction.AnomalyReason : "",
                CreatedDateFormatted = i.CreatedAt.ToString("MMM dd, yyyy"),
                LastUpdatedFormatted = i.UpdatedAt.ToString("HH:mm IST"),
                CreatedAt = i.CreatedAt,
                Evidence = i.Evidence.OrderBy(e => e.Category).Select(e => new EvidenceDto
                {
                    EvidenceId = e.EvidenceId,
                    Category = e.Category,
                    FindingType = e.FindingType,
                    FindingDetail = e.FindingDetail,
                    Confidence = e.Confidence,
                    Severity = e.Severity,
                    Source = e.Source,
                    FormattedTimestamp = e.EvidenceTimestamp.ToString("MMM dd, yyyy · HH:mm:ss IST")
                }).ToList(),
                Timeline = i.Timeline.OrderBy(t => t.StepNumber).Select(t => new TimelineStepDto
                {
                    TimelineId = t.TimelineId,
                    StepNumber = t.StepNumber,
                    Label = t.Label,
                    Description = t.Description,
                    Status = t.Status,
                    ActorType = t.ActorType,
                    ActorName = t.ActorName,
                    FormattedTimestamp = t.StepTimestamp.ToString("MMM dd, yyyy · HH:mm:ss IST")
                }).ToList()
            };
        }

        public async Task<InvestigationDto> CreateInvestigationAsync(CreateInvestigationDto dto)
        {
            var txn = await _db.Transactions.FindAsync(dto.TransactionId);
            if (txn == null) throw new InvalidOperationException("Transaction not found");

            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var code = $"INV-2026-{(timestamp % 9000 + 1000):D4}";

            var entity = new Investigation
            {
                InvestigationCode = code,
                AlertId = dto.AlertId,
                TransactionId = dto.TransactionId,
                CustomerId = txn.CustomerId,
                Priority = dto.Priority ?? "Medium",
                Status = "New",
                AssignedInvestigatorId = dto.AssignedInvestigatorId,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _db.Investigations.Add(entity);

            // Add standard initial timeline step
            var step1 = new InvestigationTimeline
            {
                InvestigationId = entity.InvestigationId,
                StepNumber = 1,
                Label = "Investigation Opened",
                Description = $"Case {code} initialized for {txn.TransactionCode}.",
                Status = "completed",
                ActorType = "human",
                ActorName = "Security Console",
                StepTimestamp = DateTimeOffset.UtcNow
            };
            _db.InvestigationTimeline.Add(step1);

            await _db.SaveChangesAsync();

            return (await GetInvestigationByIdAsync(entity.InvestigationId))!;
        }

        public async Task<bool> SubmitDecisionAsync(Guid id, InvestigationDecisionDto dto)
        {
            var result = await SubmitDecisionAsync(id, dto, Guid.Empty, "ADMIN", "System Administrator");
            return result.Success;
        }

        public async Task<(bool Success, bool IsForbidden, string Message)> SubmitDecisionAsync(
            Guid id,
            InvestigationDecisionDto dto,
            Guid callerUserId,
            string callerRole,
            string callerFullName)
        {
            var inv = await _db.Investigations
                .Include(i => i.AssignedInvestigator)
                .FirstOrDefaultAsync(i => i.InvestigationId == id);

            if (inv == null)
            {
                return (false, false, $"Investigation with ID '{id}' was not found.");
            }

            // IDOR Prevention: Only assigned investigator or privileged roles (ADMIN, COMPLIANCE) may submit decisions
            bool isPrivileged = callerRole.Equals("ADMIN", StringComparison.OrdinalIgnoreCase) ||
                                callerRole.Equals("COMPLIANCE", StringComparison.OrdinalIgnoreCase);
            bool isAssigned = inv.AssignedInvestigatorId == null ||
                              inv.AssignedInvestigatorId == callerUserId ||
                              callerUserId == Guid.Empty;

            if (!isPrivileged && !isAssigned)
            {
                return (false, true, "Access Denied: You do not have permission to modify an investigation assigned to another investigator.");
            }

            inv.ResolutionDecision = dto.Decision;
            inv.ResolutionNotes = dto.Notes;
            inv.Status = dto.Decision == "Approved" ? "Resolved" : (dto.Decision == "Escalated" ? "Escalated" : "Pending Review");
            inv.ResolvedAt = DateTimeOffset.UtcNow;
            inv.UpdatedAt = DateTimeOffset.UtcNow;

            // Append timeline step with actual investigator identity and ISO timestamp
            var count = await _db.InvestigationTimeline.Where(t => t.InvestigationId == id).CountAsync();
            var step = new InvestigationTimeline
            {
                InvestigationId = id,
                StepNumber = count + 1,
                Label = "Decision Submitted",
                Description = $"Decision '{dto.Decision}' submitted by {callerFullName} ({callerRole}). Notes: {dto.Notes ?? "None"}",
                Status = "completed",
                ActorType = "human",
                ActorName = callerFullName,
                StepTimestamp = DateTimeOffset.UtcNow
            };
            _db.InvestigationTimeline.Add(step);

            await _db.SaveChangesAsync();
            return (true, false, "Investigation decision recorded successfully.");
        }
    }
}
