using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Auth;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class RoleAuthorizationTests
    {
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly Mock<IAuditLogService> _mockAudit;
        private readonly IJwtTokenService _jwtService;

        public RoleAuthorizationTests()
        {
            _passwordHasher = new PasswordHasher<User>();
            _mockAudit = new Mock<IAuditLogService>();

            var inMemorySettings = new Dictionary<string, string?>
            {
                { "Jwt:Issuer", "FraudGuardAI" },
                { "Jwt:Audience", "FraudGuardAI.Client" },
                { "Jwt:ExpiryMinutes", "60" },
                { "Jwt:SecretKey", "TestSecretKeyForJwtAuthenticationMustBeAtLeast256BitsLong12345678!" }
            };

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            _jwtService = new JwtTokenService(config);
        }

        private FraudGuardDbContext CreateInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new FraudGuardDbContext(options);
        }

        [Fact]
        public async Task UserManagement_PreventRemovingLastActiveAdmin_OnRoleChange()
        {
            // Arrange: only 1 ADMIN in system
            using var db = CreateInMemoryDbContext();
            var adminId = Guid.NewGuid();
            var adminUser = new User
            {
                UserId = adminId,
                UserCode = "USR-ADM-001",
                FullName = "Sole Administrator",
                Email = "admin@fraudguard.io",
                PasswordHash = "hashed",
                Role = "ADMIN",
                IsActive = true
            };
            db.Users.Add(adminUser);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object, new TokenRevocationService());

            // Act: try demoting the last active ADMIN to INVESTIGATOR
            var (success, message, user) = await authService.UpdateUserRoleAsync(adminId, "INVESTIGATOR", adminId);

            // Assert
            Assert.False(success);
            Assert.Contains("last active administrator", message, StringComparison.OrdinalIgnoreCase);
            Assert.Null(user);
        }

        [Fact]
        public async Task UserManagement_PreventDeactivatingLastActiveAdmin()
        {
            // Arrange: only 1 ADMIN in system
            using var db = CreateInMemoryDbContext();
            var adminId = Guid.NewGuid();
            var adminUser = new User
            {
                UserId = adminId,
                UserCode = "USR-ADM-001",
                FullName = "Sole Administrator",
                Email = "admin@fraudguard.io",
                PasswordHash = "hashed",
                Role = "ADMIN",
                IsActive = true
            };
            db.Users.Add(adminUser);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object, new TokenRevocationService());

            // Act: try deactivating the last active ADMIN
            var (success, message, user) = await authService.UpdateUserStatusAsync(adminId, false, adminId);

            // Assert
            Assert.False(success);
            Assert.Contains("last active administrator", message, StringComparison.OrdinalIgnoreCase);
            Assert.Null(user);
        }

        [Fact]
        public async Task UserManagement_CreateUser_HashesPasswordAndEnforcesRole()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var adminId = Guid.NewGuid();
            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object, new TokenRevocationService());

            var createDto = new CreateUserRequestDto
            {
                FullName = "Suresh Compliance",
                Email = "suresh.c@fraudguard.io",
                Password = "CompliantPassword#2026",
                Role = "COMPLIANCE",
                Department = "Regulatory Audit"
            };

            // Act
            var created = await authService.CreateUserAsync(createDto, adminId);

            // Assert
            Assert.NotNull(created);
            Assert.Equal("COMPLIANCE", created.Role);
            Assert.Equal("suresh.c@fraudguard.io", created.Email);

            var inDb = await db.Users.FindAsync(created.UserId);
            Assert.NotNull(inDb);
            Assert.NotEqual("CompliantPassword#2026", inDb.PasswordHash);

            var verified = _passwordHasher.VerifyHashedPassword(inDb, inDb.PasswordHash, "CompliantPassword#2026");
            Assert.Equal(PasswordVerificationResult.Success, verified);
        }
    }
}
