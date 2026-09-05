using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.AuditLogs;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/audit-logs")]
    [Authorize(Roles = "ADMIN,COMPLIANCE")]
    public class AuditLogsController : ControllerBase
    {
        private readonly IAuditLogService _auditLogService;

        public AuditLogsController(IAuditLogService auditLogService)
        {
            _auditLogService = auditLogService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<AuditLogDto>>), 200)]
        public async Task<IActionResult> GetAuditLogs(
            [FromQuery] string? category,
            [FromQuery] string? result,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var logs = await _auditLogService.GetAuditLogsAsync(category, result, page, pageSize);
            return Ok(ApiResponse<PagedResult<AuditLogDto>>.Ok(logs));
        }

        [HttpGet("{id:long}")]
        [ProducesResponseType(typeof(ApiResponse<AuditLogDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetAuditLogById(long id)
        {
            var log = await _auditLogService.GetAuditLogByIdAsync(id);
            if (log == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Audit log with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<AuditLogDto>.Ok(log));
        }
    }
}
