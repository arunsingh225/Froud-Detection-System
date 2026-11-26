using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using FraudGuard.Api.Services.ExternalLogin;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class PhoneNumberNormalizerTests
    {
        [Theory]
        [InlineData("98765 43210", "+919876543210")]
        [InlineData("+91 98765-43210", "+919876543210")]
        [InlineData("09876543210", "+919876543210")]
        [InlineData("919876543210", "+919876543210")]
        [InlineData("0091 9876543210", "+919876543210")]
        [InlineData("+1 (415) 555-0132", "+14155550132")]
        public void Valid_numbers_become_E164(string input, string expected)
            => Assert.Equal(expected, PhoneNumberNormalizer.Normalize(input));

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("12345")]
        [InlineData("98765abc10")]
        [InlineData("+0 98765 43210")]
        [InlineData("+9198765432101234567")]
        public void Invalid_numbers_are_rejected(string? input)
            => Assert.Null(PhoneNumberNormalizer.Normalize(input));

        [Fact]
        public void A_different_default_country_code_is_used_for_national_numbers()
            => Assert.Equal("+442071234567", PhoneNumberNormalizer.Normalize("2071234567", "+44"));

        [Fact]
        public void Mask_keeps_only_the_last_four_digits()
            => Assert.Equal("*********3210", PhoneNumberNormalizer.Mask("+919876543210"));
    }

    public class ExternalLoginServiceTests
    {
        private const string Phone = "+919876543210";

        private sealed class CapturingSms : ISmsSender
        {
            public bool Enabled { get; set; } = true;
            public string ProviderName => "test";
            public bool Fail { get; set; }
            public List<(string To, string Message)> Sent { get; } = new();
            public Task SendAsync(string toE164, string message, CancellationToken cancellationToken = default)
            {
                if (Fail) throw new InvalidOperationException("boom");
                Sent.Add((toE164, message));
                return Task.CompletedTask;
            }
            public string LastCode => new string(Sent.Last().Message.SkipWhile(c => !char.IsDigit(c)).TakeWhile(char.IsDigit).ToArray());
        }

        private readonly CapturingSms _sms = new();
        private readonly Mock<IGoogleTokenVerifier> _google = new();
        private readonly Mock<IAuditLogService> _audit = new();
        private readonly FraudGuardDbContext _db;
        private readonly ExternalLoginService _service;
        private readonly User _user;

        public ExternalLoginServiceTests() : this(null) { }

        private ExternalLoginServiceTests(Dictionary<string, string?>? extraConfig)
        {
            _db = new FraudGuardDbContext(new DbContextOptionsBuilder<FraudGuardDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var settings = new Dictionary<string, string?>
            {
                { "Jwt:SecretKey", "TestSecretKeyForJwtAuthenticationMustBeAtLeast256BitsLong12345678!" },
                { "Google:ClientId", "test-client.apps.googleusercontent.com" }
            };
            if (extraConfig != null) foreach (var kv in extraConfig) settings[kv.Key] = kv.Value;
            var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

            _user = new User { UserCode = "USR-ADM-001", FullName = "Test Admin", Email = "admin@example.com", Role = "ADMIN", PhoneNumber = Phone, IsActive = true };
            _db.Users.Add(_user);
            _db.SaveChanges();
            _service = new ExternalLoginService(_db, new JwtTokenService(config), _audit.Object, _sms, _google.Object, config,
                NullLogger<ExternalLoginService>.Instance);
        }

        // ------------------------------------------------------------------ phone
        [Fact]
        public async Task A_code_is_sent_stored_only_as_a_hash_and_signs_in_once()
        {
            Assert.Equal(OtpRequestOutcome.Accepted, await _service.RequestPhoneOtpAsync("98765 43210", "127.0.0.1"));

            Assert.Single(_sms.Sent);
            Assert.Equal(Phone, _sms.Sent[0].To);
            var code = _sms.LastCode;
            Assert.Equal(6, code.Length);
            var stored = await _db.LoginOtps.SingleAsync();
            Assert.DoesNotContain(code, stored.CodeHash);                       // the code itself is not stored
            Assert.Equal(64, stored.CodeHash.Length);

            var session = await _service.VerifyPhoneOtpAsync(Phone, code, "127.0.0.1");
            Assert.NotNull(session);
            Assert.Equal("admin@example.com", session!.User.Email);
            Assert.False(string.IsNullOrEmpty(session.Token));

            Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, code, "127.0.0.1"));   // a code works only once
        }

        [Fact]
        public async Task An_unregistered_number_gets_the_same_answer_but_no_sms()
        {
            Assert.Equal(OtpRequestOutcome.Accepted, await _service.RequestPhoneOtpAsync("+919000000000", null));
            Assert.Empty(_sms.Sent);
            Assert.Empty(_db.LoginOtps);
        }

        [Fact]
        public async Task A_deactivated_user_cannot_get_or_use_a_code()
        {
            _user.IsActive = false;
            await _db.SaveChangesAsync();
            await _service.RequestPhoneOtpAsync(Phone, null);
            Assert.Empty(_sms.Sent);
        }

        [Fact]
        public async Task Wrong_codes_are_refused_and_five_wrong_guesses_kill_the_code()
        {
            await _service.RequestPhoneOtpAsync(Phone, null);
            var good = _sms.LastCode;
            var wrong = good == "000000" ? "111111" : "000000";

            for (var i = 0; i < 5; i++)
                Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, wrong, null));

            Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, good, null));   // even the right code is dead now
        }

        [Fact]
        public async Task An_expired_code_is_refused()
        {
            await _service.RequestPhoneOtpAsync(Phone, null);
            var code = _sms.LastCode;
            var otp = await _db.LoginOtps.SingleAsync();
            otp.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            await _db.SaveChangesAsync();

            Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, code, null));
        }

        [Fact]
        public async Task Only_the_newest_code_is_valid()
        {
            await _service.RequestPhoneOtpAsync(Phone, null);
            var first = _sms.LastCode;
            await _service.RequestPhoneOtpAsync(Phone, null);
            var second = _sms.LastCode;

            if (first != second) Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, first, null));
            Assert.NotNull(await _service.VerifyPhoneOtpAsync(Phone, second, null));
        }

        [Fact]
        public async Task Requests_are_throttled_per_account()
        {
            for (var i = 0; i < 6; i++) await _service.RequestPhoneOtpAsync(Phone, null);
            Assert.Equal(3, _sms.Sent.Count);                                      // default: 3 codes per 10 minutes
        }

        [Fact]
        public async Task A_code_that_could_not_be_sent_is_not_left_usable()
        {
            _sms.Fail = true;
            Assert.Equal(OtpRequestOutcome.Accepted, await _service.RequestPhoneOtpAsync(Phone, null));
            Assert.All(await _db.LoginOtps.ToListAsync(), o => Assert.NotNull(o.ConsumedAt));
        }

        [Fact]
        public async Task Phone_sign_in_is_reported_disabled_without_an_sms_provider()
        {
            _sms.Enabled = false;
            Assert.Equal(OtpRequestOutcome.Disabled, await _service.RequestPhoneOtpAsync(Phone, null));
            Assert.False(_service.GetConfig().PhoneLoginEnabled);
        }

        [Fact]
        public async Task A_badly_formed_number_is_rejected_as_invalid()
            => Assert.Equal(OtpRequestOutcome.InvalidPhone, await _service.RequestPhoneOtpAsync("not a number", null));

        [Fact]
        public async Task Malformed_codes_never_reach_the_database_check()
        {
            await _service.RequestPhoneOtpAsync(Phone, null);
            foreach (var bad in new[] { "", "12345", "1234567", "12345a", " " })
                Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, bad, null));
            Assert.Equal(0, (await _db.LoginOtps.SingleAsync()).Attempts);
        }

        // ------------------------------------------------------------------ Google
        private void GoogleSays(string email, bool verified = true)
            => _google.Setup(g => g.VerifyAsync("good-token", "test-client.apps.googleusercontent.com"))
                      .ReturnsAsync(new GoogleIdentity(email, verified, "sub-1"));

        [Fact]
        public async Task A_verified_google_account_with_a_matching_user_signs_in()
        {
            GoogleSays("Admin@Example.com");                                       // e-mail match ignores case
            var session = await _service.GoogleLoginAsync("good-token", "127.0.0.1");
            Assert.NotNull(session);
            Assert.Equal("ADMIN", session!.User.Role);
        }

        [Fact]
        public async Task A_google_token_that_fails_verification_is_refused()
        {
            _google.Setup(g => g.VerifyAsync(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync((GoogleIdentity?)null);
            Assert.Null(await _service.GoogleLoginAsync("bad-token", null));
        }

        [Fact]
        public async Task An_unverified_google_email_is_refused()
        {
            GoogleSays("admin@example.com", verified: false);
            Assert.Null(await _service.GoogleLoginAsync("good-token", null));
        }

        [Fact]
        public async Task A_google_account_without_a_fraudguard_user_is_refused_and_nothing_is_created()
        {
            GoogleSays("stranger@example.com");
            Assert.Null(await _service.GoogleLoginAsync("good-token", null));
            Assert.Equal(1, await _db.Users.CountAsync());
        }

        [Fact]
        public async Task A_deactivated_user_cannot_sign_in_with_google()
        {
            _user.IsActive = false;
            await _db.SaveChangesAsync();
            GoogleSays("admin@example.com");
            Assert.Null(await _service.GoogleLoginAsync("good-token", null));
        }

        [Fact]
        public async Task A_locked_account_cannot_sign_in_with_google_or_a_code()
        {
            _user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(10);
            await _db.SaveChangesAsync();
            GoogleSays("admin@example.com");
            Assert.Null(await _service.GoogleLoginAsync("good-token", null));

            await _service.RequestPhoneOtpAsync(Phone, null);
            Assert.Null(await _service.VerifyPhoneOtpAsync(Phone, _sms.LastCode, null));
        }

        [Fact]
        public async Task Google_sign_in_is_off_without_a_client_id()
        {
            var noGoogle = new ExternalLoginServiceTests(new Dictionary<string, string?> { { "Google:ClientId", "" } });
            Assert.Null(noGoogle._service.GetConfig().GoogleClientId);
            Assert.Null(await noGoogle._service.GoogleLoginAsync("good-token", null));
        }

        [Fact]
        public void The_config_exposes_only_public_settings()
        {
            var cfg = _service.GetConfig();
            Assert.Equal("test-client.apps.googleusercontent.com", cfg.GoogleClientId);
            Assert.True(cfg.PhoneLoginEnabled);
            Assert.Equal("+91", cfg.DefaultCountryCode);
        }
    }
}
