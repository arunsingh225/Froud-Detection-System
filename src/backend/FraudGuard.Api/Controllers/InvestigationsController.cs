using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Investigations;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class InvestigationsController : ControllerBase
    {
        private readonly IInvestigationService _investigationService;

        public InvestigationsController(IInvestigationService investigationService)
        {
            _investigationService = investigationService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<InvestigationDto>>), 200)]
        public async Task<IActionResult> GetInvestigations(
            [FromQuery] string? status,
            [FromQuery] string? priority,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var result = await _investigationService.GetInvestigationsAsync(status, priority, page, pageSize);
            return Ok(ApiResponse<PagedResult<InvestigationDto>>.Ok(result));
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(ApiResponse<InvestigationDetailDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetInvestigationById(Guid id)
        {
            var result = await _investigationService.GetInvestigationByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Investigation with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<InvestigationDetailDto>.Ok(result));
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<InvestigationDto>), 201)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        public async Task<IActionResult> CreateInvestigation([FromBody] CreateInvestigationDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid investigation payload."));
            }

            try
            {
                var result = await _investigationService.CreateInvestigationAsync(dto);
                return CreatedAtAction(nameof(GetInvestigationById), new { id = result.InvestigationId }, ApiResponse<InvestigationDto>.Ok(result, "Investigation created successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
        }

        [HttpPut("{id:guid}")]
        [HttpPatch("{id:guid}/decision")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 403)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> SubmitDecision(Guid id, [FromBody] InvestigationDecisionDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid decision payload."));
            }

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userIdStr, out var callerUserId))
            {
                return Unauthorized(ApiResponse<object>.Fail("Invalid user identity in authentication token."));
            }

            var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            var callerName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                ?? "Security Officer";

            var (success, isForbidden, message) = await _investigationService.SubmitDecisionAsync(
                id, dto, callerUserId, callerRole, callerName);

            if (isForbidden)
            {
                return StatusCode(403, ApiResponse<object>.Fail(message));
            }

            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail(message));
            }

            return Ok(ApiResponse<bool>.Ok(true, $"Investigation decision recorded as '{dto.Decision}'."));
        }
    }
}
