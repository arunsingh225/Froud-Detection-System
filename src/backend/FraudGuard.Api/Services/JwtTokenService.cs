using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly IConfiguration _configuration;
        private readonly string _issuer;
        private readonly string _audience;
        private readonly int _expiryMinutes;
        private readonly byte[] _keyBytes;

        public JwtTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
            _issuer = configuration["Jwt:Issuer"] ?? "FraudGuardAI";
            _audience = configuration["Jwt:Audience"] ?? "FraudGuardAI.Client";
            _expiryMinutes = int.TryParse(configuration["Jwt:ExpiryMinutes"], out var exp) ? exp : 60;

            _keyBytes = JwtKeyResolver.Resolve(configuration);
        }

        public (string Token, DateTimeOffset ExpiresAt) GenerateToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_expiryMinutes);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToUpperInvariant()),
                new Claim(ClaimTypes.UserData, user.UserCode),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            };

            if (!string.IsNullOrEmpty(user.Department))
            {
                claims.Add(new Claim("department", user.Department));
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = expiresAt.UtcDateTime,
                Issuer = _issuer,
                Audience = _audience,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(_keyBytes),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return (tokenHandler.WriteToken(token), expiresAt);
        }

        public ClaimsPrincipal? ValidateToken(string token)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            try
            {
                var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(_keyBytes),
                    ValidateIssuer = true,
                    ValidIssuer = _issuer,
                    ValidateAudience = true,
                    ValidAudience = _audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1)
                }, out _);

                return principal;
            }
            catch
            {
                return null;
            }
        }
    }
}
