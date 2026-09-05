using System;
using System.Collections.Generic;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class JwtTokenServiceTests
    {
        private readonly IConfiguration _config;
        private readonly JwtTokenService _jwtService;

        public JwtTokenServiceTests()
        {
            var inMemorySettings = new Dictionary<string, string?>
            {
                { "Jwt:Issuer", "FraudGuardAI" },
                { "Jwt:Audience", "FraudGuardAI.Client" },
                { "Jwt:ExpiryMinutes", "60" },
                { "Jwt:SecretKey", "TestSecretKeyForJwtAuthenticationMustBeAtLeast256BitsLong12345678!" }
            };

            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            _jwtService = new JwtTokenService(_config);
        }

        [Fact]
        public void GenerateToken_ReturnsValidSignedJwt_WithCorrectClaims()
        {
            // Arrange
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-INV-001",
                FullName = "Riya Desai",
                Email = "riya.desai@fraudguard.enterprise.io",
                Role = "INVESTIGATOR",
                Department = "FIU"
            };

            // Act
            var (token, expiresAt) = _jwtService.GenerateToken(user);

            // Assert
            Assert.NotNull(token);
            Assert.NotEmpty(token);
            Assert.True(expiresAt > DateTimeOffset.UtcNow);

            var principal = _jwtService.ValidateToken(token);
            Assert.NotNull(principal);

            var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var roleClaim = principal.FindFirst(ClaimTypes.Role)?.Value;
            var emailClaim = principal.FindFirst(ClaimTypes.Email)?.Value;
            var nameClaim = principal.FindFirst(ClaimTypes.Name)?.Value;
            var deptClaim = principal.FindFirst("department")?.Value;

            Assert.Equal(user.UserId.ToString(), idClaim);
            Assert.Equal("INVESTIGATOR", roleClaim);
            Assert.Equal(user.Email, emailClaim);
            Assert.Equal("Riya Desai", nameClaim);
            Assert.Equal("FIU", deptClaim);
        }

        [Fact]
        public void ValidateToken_WithTamperedToken_ReturnsNull()
        {
            // Arrange
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-ADM-001",
                FullName = "Priyanka Iyer",
                Email = "priyanka.iyer@fraudguard.enterprise.io",
                Role = "ADMIN"
            };

            var (token, _) = _jwtService.GenerateToken(user);
            var tamperedToken = token.Substring(0, token.Length - 5) + "XXXXX";

            // Act
            var principal = _jwtService.ValidateToken(tamperedToken);

            // Assert
            Assert.Null(principal);
        }

        [Fact]
        public void ValidateToken_WithGarbageString_ReturnsNull()
        {
            // Act
            var principal = _jwtService.ValidateToken("not.a.valid.jwt.token");

            // Assert
            Assert.Null(principal);
        }

        [Fact]
        public void JwtTokenService_ThrowsException_WhenKeyIsMissingOrTooShort()
        {
            var shortConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "Jwt:SecretKey", "TooShortKey123" }
                })
                .Build();

            Assert.Throws<InvalidOperationException>(() => new JwtTokenService(shortConfig));
        }
    }
}
