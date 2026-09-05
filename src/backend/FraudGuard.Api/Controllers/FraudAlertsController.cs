using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.FraudAlerts;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/fraud-alerts")]
    [Authorize]
    public class FraudAlertsController : ControllerBase
    {
        private readonly IFraudAlertService _alertService;

        public FraudAlertsController(IFraudAlertService alertService)
        {
            _alertService = alertService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<FraudAlertDto>>), 200)]
        public async Task<IActionResult> GetAlerts([FromQuery] string? status, [FromQuery] string? severity, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _alertService.GetAlertsAsync(status, severity, page, pageSize);
            return Ok(ApiResponse<PagedResult<FraudAlertDto>>.Ok(result));
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(ApiResponse<FraudAlertDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetAlertById(Guid id)
        {
            var result = await _alertService.GetAlertByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Fraud alert with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<FraudAlertDto>.Ok(result));
        }

        [HttpPatch("{id:guid}/resolve")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> ResolveAlert(Guid id, [FromBody] ResolveAlertDto? dto)
        {
            var success = await _alertService.ResolveAlertAsync(id, dto?.Notes);
            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail($"Fraud alert with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Fraud alert marked as resolved."));
        }

        [HttpPatch("{id:guid}/assign")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> AssignAlert(Guid id, [FromBody] AssignAlertDto dto)
        {
            var success = await _alertService.AssignAlertAsync(id, dto.UserId);
            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail($"Fraud alert with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Fraud alert assigned successfully."));
        }
    }
}
