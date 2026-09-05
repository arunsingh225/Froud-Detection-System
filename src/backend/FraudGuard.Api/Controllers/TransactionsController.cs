using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Transactions;
using FraudGuard.Api.Services;

using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using FraudGuard.Api.Hubs;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TransactionsController : ControllerBase
    {
        private readonly ITransactionService _transactionService;
        private readonly IHubContext<AnalyticsHub> _hubContext;
        private readonly IMemoryCache _cache;

        public TransactionsController(
            ITransactionService transactionService,
            IHubContext<AnalyticsHub> hubContext,
            IMemoryCache cache)
        {
            _transactionService = transactionService;
            _hubContext = hubContext;
            _cache = cache;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<TransactionDto>>), 200)]
        public async Task<IActionResult> GetTransactions(
            [FromQuery] string? search,
            [FromQuery] string? riskTier,
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _transactionService.GetTransactionsAsync(search, riskTier, status, page, pageSize);
            return Ok(ApiResponse<PagedResult<TransactionDto>>.Ok(result));
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(ApiResponse<TransactionDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetTransactionById(Guid id)
        {
            var result = await _transactionService.GetTransactionByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Transaction with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<TransactionDto>.Ok(result));
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<TransactionDto>), 201)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid transaction payload."));
            }

            var result = await _transactionService.CreateTransactionAsync(dto);

            // Invalidate analytics caches
            _cache.Remove("kpis_dashboard_v10");
            _cache.Remove("risk_distribution_v10");

            // Broadcast real-time update event to connected clients
            await _hubContext.Clients.All.SendAsync("AnalyticsUpdated", new { transactionId = result.TransactionId, code = result.TransactionCode });

            return CreatedAtAction(nameof(GetTransactionById), new { id = result.TransactionId }, ApiResponse<TransactionDto>.Ok(result, "Transaction ingested successfully."));
        }

        [HttpPatch("{id:guid}/status")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> UpdateTransactionStatus(Guid id, [FromBody] UpdateTransactionStatusDto dto)
        {
            var success = await _transactionService.UpdateStatusAsync(id, dto.Status);
            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail($"Transaction with ID '{id}' was not found."));
            }

            // Invalidate analytics caches
            _cache.Remove("kpis_dashboard_v10");
            _cache.Remove("risk_distribution_v10");

            // Broadcast real-time update event
            await _hubContext.Clients.All.SendAsync("AnalyticsUpdated", new { transactionId = id, status = dto.Status });

            return Ok(ApiResponse<bool>.Ok(true, $"Transaction status updated to '{dto.Status}'."));
        }
    }
}
