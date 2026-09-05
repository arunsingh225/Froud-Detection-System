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
    public class PasswordSecurityTests
    {
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly Mock<IAuditLogService> _mockAudit;
        private readonly IJwtTokenService _jwtService;

        public PasswordSecurityTests()
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
        public void PasswordHasher_CreatesValidHash_AndVerifiesCorrectly()
        {
            // Arrange
            var user = new User { Email = "test@fraudguard.io" };
            var password = "SecurePassword#2026";

            // Act
            var hash = _passwordHasher.HashPassword(user, password);
            var result = _passwordHasher.VerifyHashedPassword(user, hash, password);

            // Assert
            Assert.NotEmpty(hash);
            Assert.NotEqual(password, hash);
            Assert.Equal(PasswordVerificationResult.Success, result);
        }

        [Fact]
        public void PasswordHasher_RejectsIncorrectPassword()
        {
            // Arrange
            var user = new User { Email = "test@fraudguard.io" };
            var password = "SecurePassword#2026";
            var wrongPassword = "WrongPassword#123";

            // Act
            var hash = _passwordHasher.HashPassword(user, password);
            var result = _passwordHasher.VerifyHashedPassword(user, hash, wrongPassword);

            // Assert
            Assert.Equal(PasswordVerificationResult.Failed, result);
        }

        [Fact]
        public async Task AuthService_ValidPassword_LoginSucceeds_AndResetsFailureCount()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-INV-001",
                FullName = "Riya Desai",
                Email = "riya.desai@fraudguard.enterprise.io",
                Role = "INVESTIGATOR",
                IsActive = true,
                AccessFailedCount = 3
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, "SecurePass#2026");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object);

            // Act
            var loginResult = await authService.LoginAsync(new LoginRequestDto
            {
                Email = "riya.desai@fraudguard.enterprise.io",
                Password = "SecurePass#2026"
            });

            // Assert
            Assert.NotNull(loginResult);
            Assert.NotNull(loginResult.Token);
            Assert.Equal("INVESTIGATOR", loginResult.User.Role);

            var updatedUser = await db.Users.FindAsync(user.UserId);
            Assert.NotNull(updatedUser);
            Assert.Equal(0, updatedUser.AccessFailedCount);
            Assert.Null(updatedUser.LockoutEnd);
        }

        [Fact]
        public async Task AuthService_InvalidPassword_IncrementsAccessFailedCount()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-INV-001",
                FullName = "Riya Desai",
                Email = "riya.desai@fraudguard.enterprise.io",
                Role = "INVESTIGATOR",
                IsActive = true,
                AccessFailedCount = 0
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, "CorrectPassword#1");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object);

            // Act
            var loginResult = await authService.LoginAsync(new LoginRequestDto
            {
                Email = "riya.desai@fraudguard.enterprise.io",
                Password = "WrongPassword#999"
            });

            // Assert
            Assert.Null(loginResult);

            var updatedUser = await db.Users.FindAsync(user.UserId);
            Assert.NotNull(updatedUser);
            Assert.Equal(1, updatedUser.AccessFailedCount);
            Assert.Null(updatedUser.LockoutEnd);
        }

        [Fact]
        public async Task AuthService_FiveConsecutiveFailedAttempts_LocksAccountFor15Minutes()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-INV-001",
                FullName = "Riya Desai",
                Email = "riya.desai@fraudguard.enterprise.io",
                Role = "INVESTIGATOR",
                IsActive = true,
                AccessFailedCount = 4
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, "CorrectPassword#1");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object);

            // Act: 5th failed attempt
            var loginResult = await authService.LoginAsync(new LoginRequestDto
            {
                Email = "riya.desai@fraudguard.enterprise.io",
                Password = "WrongPassword#999"
            });

            // Assert
            Assert.Null(loginResult);

            var updatedUser = await db.Users.FindAsync(user.UserId);
            Assert.NotNull(updatedUser);
            Assert.Equal(5, updatedUser.AccessFailedCount);
            Assert.NotNull(updatedUser.LockoutEnd);
            Assert.True(updatedUser.LockoutEnd.Value > DateTimeOffset.UtcNow.AddMinutes(10));
        }

        [Fact]
        public async Task AuthService_LockedAccount_RejectsLoginEvenWithCorrectPassword()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-INV-001",
                FullName = "Riya Desai",
                Email = "riya.desai@fraudguard.enterprise.io",
                Role = "INVESTIGATOR",
                IsActive = true,
                AccessFailedCount = 5,
                LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15)
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, "CorrectPassword#1");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object);

            // Act
            var loginResult = await authService.LoginAsync(new LoginRequestDto
            {
                Email = "riya.desai@fraudguard.enterprise.io",
                Password = "CorrectPassword#1"
            });

            // Assert
            Assert.Null(loginResult);
        }

        [Fact]
        public async Task AuthService_InactiveUser_CannotLogin()
        {
            // Arrange
            using var db = CreateInMemoryDbContext();
            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = "USR-INV-002",
                FullName = "Deactivated User",
                Email = "inactive@fraudguard.enterprise.io",
                Role = "INVESTIGATOR",
                IsActive = false
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, "SomePassword#1");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var authService = new AuthService(db, _jwtService, _passwordHasher, _mockAudit.Object);

            // Act
            var loginResult = await authService.LoginAsync(new LoginRequestDto
            {
                Email = "inactive@fraudguard.enterprise.io",
                Password = "SomePassword#1"
            });

            // Assert
            Assert.Null(loginResult);
        }
    }
}
