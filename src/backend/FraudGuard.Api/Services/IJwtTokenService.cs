using System;
using System.Security.Claims;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public interface IJwtTokenService
    {
        (string Token, DateTimeOffset ExpiresAt) GenerateToken(User user);
        ClaimsPrincipal? ValidateToken(string token);
    }
}
