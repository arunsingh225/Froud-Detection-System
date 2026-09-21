using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.AuditLogs;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public interface IAuditLogService
    {
        Task<PagedResult<AuditLogDto>> GetAuditLogsAsync(string? category, string? result, int page, int pageSize);
        Task<AuditLogDto?> GetAuditLogByIdAsync(long id);
        Task<AuditLogDto> LogActivityAsync(string actorName, string actorType, string action, string resourceTarget, string result, string category, string? subAction, Guid? actorId, string? ipAddress);
    }

    public class AuditLogService : IAuditLogService
    {
        private readonly FraudGuardDbContext _db;

        public AuditLogService(FraudGuardDbContext db)
        {
            _db = db;
        }

        public async Task<PagedResult<AuditLogDto>> GetAuditLogsAsync(string? category, string? result, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.AuditLogs.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(a => a.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(result) && !result.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(a => a.Result == result);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AuditLogDto
                {
                    AuditLogId = a.AuditLogId,
                    AuditCode = a.AuditCode,
                    TimestampFormatted = a.CreatedAt.ToString("MMM dd, yyyy HH:mm:ss IST"),
                    DateFormatted = a.CreatedAt.ToString("MMM dd, yyyy"),
                    TimeFormatted = a.CreatedAt.ToString("HH:mm:ss IST"),
                    ActorName = a.ActorName,
                    ActorType = a.ActorType,
                    Action = a.Action,
                    SubAction = a.SubAction,
                    ResourceTarget = a.ResourceTarget,
                    Result = a.Result,
                    Category = a.Category,
                    MerkleHash = a.MerkleHash
                })
                .ToListAsync();

            return new PagedResult<AuditLogDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<AuditLogDto?> GetAuditLogByIdAsync(long id)
        {
            var a = await _db.AuditLogs.FindAsync(id);
            if (a == null) return null;

            return new AuditLogDto
            {
                AuditLogId = a.AuditLogId,
                AuditCode = a.AuditCode,
                TimestampFormatted = a.CreatedAt.ToString("MMM dd, yyyy HH:mm:ss IST"),
                DateFormatted = a.CreatedAt.ToString("MMM dd, yyyy"),
                TimeFormatted = a.CreatedAt.ToString("HH:mm:ss IST"),
                ActorName = a.ActorName,
                ActorType = a.ActorType,
                Action = a.Action,
                SubAction = a.SubAction,
                ResourceTarget = a.ResourceTarget,
                Result = a.Result,
                Category = a.Category,
                MerkleHash = a.MerkleHash
            };
        }

        public async Task<AuditLogDto> LogActivityAsync(string actorName, string actorType, string action, string resourceTarget, string result, string category, string? subAction, Guid? actorId, string? ipAddress)
        {
            var count = await _db.AuditLogs.CountAsync();
            var code = $"AUD-2026-{(count + 1).ToString().PadLeft(3, '0')}";

            using var sha = SHA256.Create();
            var hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes($"{code}-{actorName}-{action}-{DateTimeOffset.UtcNow.Ticks}"));
            var hashString = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();

            var entity = new AuditLog
            {
                AuditCode = code,
                ActorId = actorId,
                ActorName = Trunc(actorName, 200),
                ActorType = Trunc(actorType, 50),
                Action = Trunc(action, 100),
                SubAction = subAction is null ? null : Trunc(subAction, 200),
                ResourceTarget = Trunc(resourceTarget, 200),
                Result = Trunc(result, 50),
                Category = Trunc(category, 100),
                IPAddress = ipAddress,
                MerkleHash = hashString,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.AuditLogs.Add(entity);
            await _db.SaveChangesAsync();

            return (await GetAuditLogByIdAsync(entity.AuditLogId))!;
        }

        private static string Trunc(string? s, int max) =>
            string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);
    }
}
