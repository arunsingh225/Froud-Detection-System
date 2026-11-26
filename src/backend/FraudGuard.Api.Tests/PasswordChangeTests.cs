using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Auth;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class PasswordPolicyTests
    {
        [Theory]
        [InlineData("Abcdef12")]
        [InlineData("a-long passphrase 2026 for me")]
        [InlineData("Passw0rd9")]
        public void Acceptable_passwords_pass(string password) => Assert.Null(PasswordPolicy.Validate(password));

        [Theory]
        [InlineData(null, "at least 8")]
        [InlineData("", "at least 8")]
        [InlineData("Ab1", "at least 8")]
        [InlineData("abcdefgh", "letter and one number")]
        [InlineData("12345678", "letter and one number")]
        [InlineData(" Abcdef12", "start or end with a space")]
        public void Weak_passwords_are_refused_with_a_reason(string? password, string reason)
            => Assert.Contains(reason, PasswordPolicy.Validate(password));

        [Fact]
        public void The_new_password_must_differ_from_the_current_one()
            => Assert.Contains("different", PasswordPolicy.Validate("Abcdef12", currentPassword: "Abcdef12"));

        [Fact]
        public void The_message_never_repeats_the_password()
            => Assert.DoesNotContain("hunter2", PasswordPolicy.Validate("hunter2") ?? "");
    }

    public class PasswordChangeTests
    {
        private const string Old = "OldPassw0rd!";
        private readonly DbContextOptions<FraudGuardDbContext> _options = new DbContextOptionsBuilder<FraudGuardDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        private readonly FraudGuardDbContext _db;
        private readonly IPasswordHasher<User> _hasher = new PasswordHasher<User>();
        private readonly Mock<IAuditLogService> _audit = new();
        private readonly AuthService _auth;
        private readonly User _user;

        public PasswordChangeTests()
        {
            _db = new FraudGuardDbContext(_options);
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:SecretKey", "TestSecretKeyForJwtAuthenticationMustBeAtLeast256BitsLong12345678!" }
            }).Build();
            _user = new User { UserCode = "USR-INV-001", FullName = "Riya Test", Email = "riya@example.com", Role = "INVESTIGATOR", IsActive = true };
            _user.PasswordHash = _hasher.HashPassword(_user, Old);
            _db.Users.Add(_user);
            _db.SaveChanges();
            _auth = new AuthService(_db, new JwtTokenService(config), _hasher, _audit.Object, new TokenRevocationService(
                // each revocation gets its own context on the same in-memory store (a scope disposes what it creates)
                new ServiceCollection().AddScoped(_ => new FraudGuardDbContext(_options)).BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
                new MemoryCache(new MemoryCacheOptions())));
        }

        private async Task<bool> CanSignInWith(string password)
            => await _auth.LoginAsync(new LoginRequestDto { Email = "riya@example.com", Password = password }) != null;

        [Fact]
        public async Task Changing_the_password_makes_the_new_one_work_the_old_one_stop_and_revokes_sessions()
        {
            var (ok, message) = await _auth.ChangePasswordAsync(_user.UserId, Old, "NewPassw0rd!");

            Assert.True(ok, message);
            Assert.True(await CanSignInWith("NewPassw0rd!"));
            Assert.False(await CanSignInWith(Old));
            Assert.NotNull((await _db.Users.AsNoTracking().SingleAsync()).TokensRevokedAt);   // every earlier session is dead
        }

        [Fact]
        public async Task A_wrong_current_password_changes_nothing_and_counts_as_a_failed_attempt()
        {
            var (ok, message) = await _auth.ChangePasswordAsync(_user.UserId, "not-my-password", "NewPassw0rd!");

            Assert.False(ok);
            Assert.Contains("not correct", message);
            Assert.Equal(1, (await _db.Users.AsNoTracking().SingleAsync()).AccessFailedCount);
            Assert.True(await CanSignInWith(Old));                       // the old password is untouched
        }

        [Fact]
        public async Task Guessing_the_current_password_through_this_endpoint_locks_the_account()
        {
            for (var i = 0; i < 5; i++) await _auth.ChangePasswordAsync(_user.UserId, "guess" + i, "NewPassw0rd!");

            var (ok, message) = await _auth.ChangePasswordAsync(_user.UserId, Old, "NewPassw0rd!");   // even the right one is refused now
            Assert.False(ok);
            Assert.Contains("Too many", message);
            Assert.False(await CanSignInWith(Old));                                                     // login is locked too
        }

        [Theory]
        [InlineData("short1")]
        [InlineData("onlyletters")]
        [InlineData(Old)]
        public async Task A_weak_or_unchanged_new_password_is_refused_and_the_old_one_still_works(string weak)
        {
            var (ok, _) = await _auth.ChangePasswordAsync(_user.UserId, Old, weak);
            Assert.False(ok);
            Assert.True(await CanSignInWith(Old));
            Assert.Null((await _db.Users.AsNoTracking().SingleAsync()).TokensRevokedAt);               // nothing was revoked
        }

        [Fact]
        public async Task An_inactive_or_unknown_account_cannot_change_a_password()
        {
            _user.IsActive = false;
            await _db.SaveChangesAsync();
            Assert.False((await _auth.ChangePasswordAsync(_user.UserId, Old, "NewPassw0rd!")).Success);
            Assert.False((await _auth.ChangePasswordAsync(Guid.NewGuid(), Old, "NewPassw0rd!")).Success);
        }

        [Fact]
        public async Task An_admin_reset_sets_the_password_clears_a_lockout_and_revokes_sessions()
        {
            _user.AccessFailedCount = 5;
            _user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(10);
            await _db.SaveChangesAsync();

            var (ok, message) = await _auth.ResetPasswordAsync(_user.UserId, "Reset1234", Guid.NewGuid());

            Assert.True(ok, message);
            Assert.True(await CanSignInWith("Reset1234"));
            Assert.False(await CanSignInWith(Old));
            Assert.NotNull((await _db.Users.AsNoTracking().SingleAsync()).TokensRevokedAt);
        }

        [Fact]
        public async Task An_admin_reset_follows_the_same_policy_and_needs_a_real_user()
        {
            Assert.False((await _auth.ResetPasswordAsync(_user.UserId, "weak", Guid.NewGuid())).Success);
            Assert.False((await _auth.ResetPasswordAsync(Guid.NewGuid(), "Reset1234", Guid.NewGuid())).Success);
            Assert.True(await CanSignInWith(Old));
        }

        [Fact]
        public async Task New_accounts_must_meet_the_same_policy()
        {
            var weak = new CreateUserRequestDto { FullName = "New Person", Email = "new@example.com", Password = "alllettersonly", Role = "VIEWER" };
            await Assert.ThrowsAsync<InvalidOperationException>(() => _auth.CreateUserAsync(weak, Guid.NewGuid()));
            Assert.Equal(1, await _db.Users.CountAsync());
        }

        [Fact]
        public async Task Every_change_is_written_to_the_audit_log_without_the_password()
        {
            await _auth.ChangePasswordAsync(_user.UserId, "wrong", "NewPassw0rd!");
            await _auth.ChangePasswordAsync(_user.UserId, Old, "NewPassw0rd!");

            _audit.Verify(a => a.LogActivityAsync(It.IsAny<string>(), It.IsAny<string>(), "PASSWORD_CHANGE", It.IsAny<string>(), "FAILED",
                It.IsAny<string>(), It.IsAny<string?>(), _user.UserId, It.IsAny<string?>()), Times.Once);
            _audit.Verify(a => a.LogActivityAsync(It.IsAny<string>(), It.IsAny<string>(), "PASSWORD_CHANGED", It.IsAny<string>(), "SUCCESS",
                It.IsAny<string>(), It.Is<string?>(d => d != null && !d.Contains("NewPassw0rd") && !d.Contains(Old)), _user.UserId, It.IsAny<string?>()), Times.Once);
        }
    }
}
