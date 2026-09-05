using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Reports;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;

        public ReportsController(IReportService reportService)
        {
            _reportService = reportService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<ReportDto>>), 200)]
        public async Task<IActionResult> GetReports(
            [FromQuery] string? category,
            [FromQuery] string? riskLevel,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _reportService.GetReportsAsync(category, riskLevel, page, pageSize);
            return Ok(ApiResponse<PagedResult<ReportDto>>.Ok(result));
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(ApiResponse<ReportDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetReportById(Guid id)
        {
            var result = await _reportService.GetReportByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Report with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<ReportDto>.Ok(result));
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<ReportDto>), 201)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        public async Task<IActionResult> CreateReport([FromBody] CreateReportDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid report payload."));
            }

            // Always use the authenticated user's identity — never accept userId from query
            var authenticatedUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(authenticatedUserIdStr, out var effectiveUserId))
            {
                return Unauthorized(ApiResponse<object>.Fail("Unable to identify authenticated user."));
            }

            var result = await _reportService.CreateReportAsync(dto, effectiveUserId);
            return CreatedAtAction(nameof(GetReportById), new { id = result.ReportId }, ApiResponse<ReportDto>.Ok(result, "SAR/Audit report created successfully."));
        }
    }
}
