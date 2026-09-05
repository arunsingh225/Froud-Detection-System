using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using FraudGuard.Api.DTOs.AIInvestigator;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/ai-investigator")]
    [Authorize]
    [EnableRateLimiting("ai_policy")]
    public class AIInvestigatorController : ControllerBase
    {
        private readonly IAIInvestigatorService _investigatorService;
        private readonly ILogger<AIInvestigatorController> _logger;

        public AIInvestigatorController(IAIInvestigatorService investigatorService, ILogger<AIInvestigatorController> logger)
        {
            _investigatorService = investigatorService;
            _logger = logger;
        }

        [HttpPost("investigate")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<InvestigationDetailFullDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> Investigate([FromBody] InvestigateRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid investigation request."));
            }

            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(ApiResponse<object>.Fail("Invalid user identity in token."));
            }

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

            try
            {
                var result = await _investigatorService.RunInvestigationAsync(request, userId, ipAddress);
                return Ok(ApiResponse<InvestigationDetailFullDto>.Ok(result, "AI investigation completed successfully."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AI Investigation failed for transaction {TransactionId}", request.TransactionId);
                return BadRequest(ApiResponse<object>.Fail("AI investigation could not be completed. Please try again."));
            }
        }

        [HttpGet("{id:guid}")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<InvestigationDetailFullDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetInvestigation(Guid id)
        {
            var result = await _investigatorService.GetInvestigationByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Investigation with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<InvestigationDetailFullDto>.Ok(result));
        }

        [HttpGet("{id:guid}/evidence")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<List<EvidenceItemDto>>), 200)]
        public async Task<IActionResult> GetEvidence(Guid id)
        {
            var result = await _investigatorService.GetEvidenceByInvestigationIdAsync(id);
            return Ok(ApiResponse<List<EvidenceItemDto>>.Ok(result));
        }

        [HttpGet("{id:guid}/timeline")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<List<InvestigationTimelineDto>>), 200)]
        public async Task<IActionResult> GetTimeline(Guid id)
        {
            var result = await _investigatorService.GetTimelineByInvestigationIdAsync(id);
            return Ok(ApiResponse<List<InvestigationTimelineDto>>.Ok(result));
        }

        [HttpPost("{id:guid}/regenerate")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<InvestigationDetailFullDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> Regenerate(Guid id)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(ApiResponse<object>.Fail("Invalid user identity in token."));
            }

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

            try
            {
                var result = await _investigatorService.RegenerateInvestigationAsync(id, userId, ipAddress);
                return Ok(ApiResponse<InvestigationDetailFullDto>.Ok(result, "Investigation re-analyzed successfully."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Investigation regeneration failed for ID {InvestigationId}", id);
                return BadRequest(ApiResponse<object>.Fail("Investigation regeneration could not be completed. Please try again."));
            }
        }
    }
}
