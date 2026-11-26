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
using FraudGuard.Api.Services.ExternalLogin;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ITokenRevocationService _revocationService;
        private readonly IHostEnvironment _env;
        private readonly IExternalLoginService _externalLogin;

        /// <summary>
        /// Name of the HttpOnly cookie used for JWT authentication.
        /// </summary>
        internal const string AuthCookieName = "FG_Auth";

        public AuthController(
            IAuthService authService,
            ITokenRevocationService revocationService,
            IHostEnvironment env,
            IExternalLoginService externalLogin)
        {
            _externalLogin = externalLogin;
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

            return Ok(ApiResponse<AuthResponseDto>.Ok(StartSession(result), "Authentication successful."));
        }

        /// <summary>What the sign-in page may offer (Google client id, whether phone sign-in is switched on).</summary>
        [HttpGet("config")]
        [AllowAnonymous]
        [ProducesResponseType(typeof(ApiResponse<AuthConfigDto>), 200)]
        public IActionResult GetConfig() => Ok(ApiResponse<AuthConfigDto>.Ok(_externalLogin.GetConfig()));

        /// <summary>Asks for a one-time code by SMS. The answer is the same whether or not the number is registered.</summary>
        [HttpPost("otp/request")]
        [AllowAnonymous]
        [EnableRateLimiting("otp_policy")]
        public async Task<IActionResult> RequestOtp([FromBody] OtpRequestDto request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Enter a valid phone number."));
            var outcome = await _externalLogin.RequestPhoneOtpAsync(request.Phone, HttpContext.Connection.RemoteIpAddress?.ToString());
            return outcome switch
            {
                OtpRequestOutcome.InvalidPhone => BadRequest(ApiResponse<object>.Fail("Enter a valid phone number.")),
                OtpRequestOutcome.Disabled => StatusCode(503, ApiResponse<object>.Fail("Phone sign-in is not available.")),
                _ => Ok(ApiResponse<object>.Ok(new { }, "If this number is registered, a sign-in code has been sent."))
            };
        }

        [HttpPost("otp/verify")]
        [AllowAnonymous]
        [EnableRateLimiting("otp_policy")]
        public async Task<IActionResult> VerifyOtp([FromBody] OtpVerifyDto request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid request."));
            var result = await _externalLogin.VerifyPhoneOtpAsync(request.Phone, request.Code, HttpContext.Connection.RemoteIpAddress?.ToString());
            return result == null
                ? Unauthorized(ApiResponse<object>.Fail("The code is wrong or has expired."))
                : Ok(ApiResponse<AuthResponseDto>.Ok(StartSession(result), "Authentication successful."));
        }

        /// <summary>Signs in an existing, active account whose e-mail matches a verified Google ID token.</summary>
        [HttpPost("google")]
        [AllowAnonymous]
        [EnableRateLimiting("login_policy")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequestDto request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid request."));
            var result = await _externalLogin.GoogleLoginAsync(request.Credential, HttpContext.Connection.RemoteIpAddress?.ToString());
            return result == null
                ? Unauthorized(ApiResponse<object>.Fail("This Google account cannot sign in."))
                : Ok(ApiResponse<AuthResponseDto>.Ok(StartSession(result), "Authentication successful."));
        }

        /// <summary>Sets the JWT as an HttpOnly cookie and returns the profile without the raw token.</summary>
        private AuthResponseDto StartSession(AuthResponseDto result)
        {
            Response.Cookies.Append(AuthCookieName, result.Token, new CookieOptions
            {
                HttpOnly = true,
                Secure = !_env.IsDevelopment(), // Secure in production (HTTPS), relaxed in dev (HTTP)
                SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
                Path = "/",
                Expires = result.ExpiresAt.UtcDateTime
            });
            return new AuthResponseDto
            {
                Token = string.Empty, // Not exposed to JavaScript
                TokenType = "HttpOnly-Cookie",
                ExpiresAt = result.ExpiresAt,
                User = result.User
            };
        }

        /// <summary>The signed-in user changes their own password; all of their sessions are signed out afterwards.</summary>
        [HttpPost("change-password")]
        [Authorize]
        [EnableRateLimiting("login_policy")]
        [ProducesResponseType(typeof(ApiResponse<object>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Enter your current password and a new one."));

            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (!Guid.TryParse(userIdStr, out var userId))
                return Unauthorized(ApiResponse<object>.Fail("Invalid or missing user identity claim in token."));

            var (success, message) = await _authService.ChangePasswordAsync(
                userId, request.CurrentPassword, request.NewPassword, HttpContext.Connection.RemoteIpAddress?.ToString());
            if (!success) return BadRequest(ApiResponse<object>.Fail(message));

            Response.Cookies.Delete(AuthCookieName, new CookieOptions
            {
                HttpOnly = true,
                Secure = !_env.IsDevelopment(),
                SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
                Path = "/"
            });
            return Ok(ApiResponse<object>.Ok(new { }, message));
        }

        [HttpPost("logout")]
        [Authorize]
        [ProducesResponseType(typeof(ApiResponse<object>), 200)]
        public async Task<IActionResult> Logout()
        {
            // Clear the authentication cookie
            Response.Cookies.Delete(AuthCookieName, new CookieOptions
            {
                HttpOnly = true,
                Secure = !_env.IsDevelopment(),
                SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
                Path = "/"
            });

            // Revoke the user's tokens (persisted) so any existing JWT is immediately invalid
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var userId))
            {
                await _revocationService.RevokeUserAsync(userId);
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
