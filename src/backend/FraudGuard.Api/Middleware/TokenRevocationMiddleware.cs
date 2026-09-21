using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Middleware
{
    /// <summary>
    /// Validates that the authenticated user's token has not been revoked.
    /// Checks the JWT "iat" (issued-at) claim against the in-memory revocation store.
    /// If the token was issued before the user was revoked, returns 401.
    /// </summary>
    public class TokenRevocationMiddleware
    {
        private readonly RequestDelegate _next;

        public TokenRevocationMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ITokenRevocationService revocationService)
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

                var iatClaim = context.User.FindFirst(JwtRegisteredClaimNames.Iat)?.Value;

                if (!string.IsNullOrEmpty(userIdClaim) && Guid.TryParse(userIdClaim, out var userId))
                {
                    // Parse issued-at timestamp from JWT
                    var issuedAt = DateTimeOffset.MinValue;
                    if (!string.IsNullOrEmpty(iatClaim) && long.TryParse(iatClaim, out var epoch))
                    {
                        issuedAt = DateTimeOffset.FromUnixTimeSeconds(epoch);
                    }

                    if (revocationService.IsTokenRevoked(userId, issuedAt))
                    {
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsync(
                            "{\"success\":false,\"message\":\"Session has been invalidated. Please log in again.\"}");
                        return;
                    }
                }
            }

            await _next(context);
        }
    }
}
