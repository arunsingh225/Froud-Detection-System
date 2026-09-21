using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Hosting;
using FraudGuard.Api.DTOs.Auth;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ITokenRevocationService _revocationService;
        private readonly IHostEnvironment _env;

        /// <summary>
        /// Name of the HttpOnly cookie used for JWT authentication.
        /// </summary>
        internal const string AuthCookieName = "FG_Auth";

        public AuthController(
            IAuthService authService,
            ITokenRevocationService revocationService,
            IHostEnvironment env)
        {
            _authService = authService;
            _revocationService = revocationService;
            _env = env;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("login_policy")]
        [ProducesResponseType(typeof(ApiResponse<AuthResponseDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 401)]
        [ProducesResponseType(typeof(ApiResponse<object>), 429)]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid login request."));
            }

            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _authService.LoginAsync(request, clientIp);
            if (result == null)
            {
                return Unauthorized(ApiResponse<object>.Fail("Invalid credentials or account inactive."));
            }

            // Set JWT as HttpOnly cookie — not accessible from JavaScript
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = !_env.IsDevelopment(), // Secure in production (HTTPS), relaxed in dev (HTTP)
                SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
                Path = "/",
                Expires = result.ExpiresAt.UtcDateTime
            };

            Response.Cookies.Append(AuthCookieName, result.Token, cookieOptions);

            // Return user profile without the raw JWT — credential stays in HttpOnly cookie only
            var safeResponse = new AuthResponseDto
            {
                Token = string.Empty, // Not exposed to JavaScript
                TokenType = "HttpOnly-Cookie",
                ExpiresAt = result.ExpiresAt,
                User = result.User
            };

            return Ok(ApiResponse<AuthResponseDto>.Ok(safeResponse, "Authentication successful."));
        }

        [HttpPost("logout")]
        [Authorize]
        [ProducesResponseType(typeof(ApiResponse<object>), 200)]
        public IActionResult Logout()
        {
            // Clear the authentication cookie
            Response.Cookies.Delete(AuthCookieName, new CookieOptions
            {
                HttpOnly = true,
                Secure = !_env.IsDevelopment(),
                SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
                Path = "/"
            });

            // Revoke the user's tokens in-memory so any existing JWT is immediately invalid
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var userId))
            {
                _revocationService.RevokeUser(userId);
            }

            return Ok(ApiResponse<object>.Ok(new { }, "Logged out successfully. Session invalidated."));
        }

        [HttpGet("me")]
        [Authorize]
        [ProducesResponseType(typeof(ApiResponse<UserProfileDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 401)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized(ApiResponse<object>.Fail("Invalid or missing user identity claim in token."));
            }

            var profile = await _authService.GetUserProfileAsync(userId);
            if (profile == null)
            {
                return NotFound(ApiResponse<object>.Fail("User profile not found or account inactive."));
            }

            return Ok(ApiResponse<UserProfileDto>.Ok(profile));
        }
    }
}
