using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Search;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SearchController : ControllerBase
    {
        private readonly FraudGuardDbContext _db;

        public SearchController(FraudGuardDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<List<SearchResultDto>>), 200)]
        public async Task<IActionResult> Search([FromQuery] string? q)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return Ok(ApiResponse<List<SearchResultDto>>.Ok(new List<SearchResultDto>()));
            }

            var query = q.Trim();
            var results = new List<SearchResultDto>();

            // 1. Transactions (Match by code, customer name, or payment method)
            var transactions = await _db.Transactions
                .Include(t => t.Customer)
                .Where(t => t.TransactionCode.Contains(query) ||
                            (t.Customer != null && t.Customer.FullName.Contains(query)) ||
                            t.PaymentMethod.Contains(query))
                .OrderByDescending(t => t.TransactionTimestamp)
                .Take(5)
                .Select(t => new SearchResultDto
                {
                    Type = "transaction",
                    Id = t.TransactionId.ToString(),
                    Title = t.TransactionCode,
                    Subtitle = $"{(t.Customer != null ? t.Customer.FullName : "Customer")} • ₹{t.AmountInr:N0} • {t.Status}",
                    Route = $"/transactions/{t.TransactionId}"
                })
                .ToListAsync();
            results.AddRange(transactions);

            // 2. Customers (Match by full name, customer code, or email)
            var customers = await _db.Customers
                .Where(c => c.FullName.Contains(query) ||
                            c.CustomerCode.Contains(query) ||
                            c.Email.Contains(query))
                .OrderBy(c => c.FullName)
                .Take(5)
                .Select(c => new SearchResultDto
                {
                    Type = "customer",
                    Id = c.CustomerId.ToString(),
                    Title = c.FullName,
                    Subtitle = $"{c.CustomerCode} • {c.RiskTier} Risk • {c.Email}",
                    Route = $"/customers/{c.CustomerId}"
                })
                .ToListAsync();
            results.AddRange(customers);

            // 3. Fraud Alerts (Match by alert code, severity, reason, or status)
            var alerts = await _db.FraudAlerts
                .Include(a => a.Customer)
                .Where(a => a.AlertCode.Contains(query) ||
                            a.Severity.Contains(query) ||
                            a.Reason.Contains(query) ||
                            a.Status.Contains(query))
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .Select(a => new SearchResultDto
                {
                    Type = "alert",
                    Id = a.AlertId.ToString(),
                    Title = a.AlertCode,
                    Subtitle = $"{a.Severity} Severity • {a.Status} • {(a.Customer != null ? a.Customer.FullName : "Unknown")}",
                    Route = "/fraud-alerts"
                })
                .ToListAsync();
            results.AddRange(alerts);

            // 4. Investigations (Match by investigation code, status, priority, or notes)
            var investigations = await _db.Investigations
                .Include(i => i.Customer)
                .Where(i => i.InvestigationCode.Contains(query) ||
                            i.Status.Contains(query) ||
                            i.Priority.Contains(query) ||
                            (i.ResolutionNotes != null && i.ResolutionNotes.Contains(query)))
                .OrderByDescending(i => i.CreatedAt)
                .Take(5)
                .Select(i => new SearchResultDto
                {
                    Type = "investigation",
                    Id = i.InvestigationId.ToString(),
                    Title = i.InvestigationCode,
                    Subtitle = $"{i.Priority} Priority • {i.Status} • {(i.Customer != null ? i.Customer.FullName : "Case")}",
                    Route = $"/investigations/{i.InvestigationId}"
                })
                .ToListAsync();
            results.AddRange(investigations);

            return Ok(ApiResponse<List<SearchResultDto>>.Ok(results, $"Found {results.Count} matches."));
        }
    }
}
