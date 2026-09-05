using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Auth;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMIN")]
    public class UsersController : ControllerBase
    {
        private readonly IAuthService _authService;

        public UsersController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<List<UserDto>>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 401)]
        [ProducesResponseType(typeof(ApiResponse<object>), 403)]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _authService.GetAllUsersAsync();
            return Ok(ApiResponse<List<UserDto>>.Ok(users));
        }

        [HttpPost]
        [ProducesResponseType(typeof(ApiResponse<UserDto>), 201)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        [ProducesResponseType(typeof(ApiResponse<object>), 401)]
        [ProducesResponseType(typeof(ApiResponse<object>), 403)]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid user creation payload."));
            }

            var adminUserId = GetAdminUserId();
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();

            try
            {
                var created = await _authService.CreateUserAsync(request, adminUserId, clientIp);
                return CreatedAtAction(nameof(GetUsers), ApiResponse<UserDto>.Ok(created, "User created successfully."));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
        }

        [HttpPatch("{id}/role")]
        [ProducesResponseType(typeof(ApiResponse<UserDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        [ProducesResponseType(typeof(ApiResponse<object>), 401)]
        [ProducesResponseType(typeof(ApiResponse<object>), 403)]
        public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateUserRoleRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid role update request."));
            }

            var adminUserId = GetAdminUserId();
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();

            var (success, message, user) = await _authService.UpdateUserRoleAsync(id, request.Role, adminUserId, clientIp);
            if (!success)
            {
                return BadRequest(ApiResponse<object>.Fail(message));
            }

            return Ok(ApiResponse<UserDto>.Ok(user!, message));
        }

        [HttpPatch("{id}/status")]
        [ProducesResponseType(typeof(ApiResponse<UserDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        [ProducesResponseType(typeof(ApiResponse<object>), 401)]
        [ProducesResponseType(typeof(ApiResponse<object>), 403)]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateUserStatusRequestDto request)
        {
            var adminUserId = GetAdminUserId();
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();

            var (success, message, user) = await _authService.UpdateUserStatusAsync(id, request.IsActive, adminUserId, clientIp);
            if (!success)
            {
                return BadRequest(ApiResponse<object>.Fail(message));
            }

            return Ok(ApiResponse<UserDto>.Ok(user!, message));
        }

        private Guid GetAdminUserId()
        {
            var idStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (Guid.TryParse(idStr, out var id))
            {
                return id;
            }

            return Guid.Empty;
        }
    }
}
