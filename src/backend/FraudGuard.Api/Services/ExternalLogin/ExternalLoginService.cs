using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Auth;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services.ExternalLogin
{
    public enum OtpRequestOutcome
    {
        /// <summary>The request was processed. The answer is deliberately the same whether or not the number is registered.</summary>
        Accepted,
        InvalidPhone,
        /// <summary>No SMS provider is configured.</summary>
        Disabled
    }

    public interface IExternalLoginService
    {
        AuthConfigDto GetConfig();
        Task<OtpRequestOutcome> RequestPhoneOtpAsync(string phone, string? ipAddress);
        Task<AuthResponseDto?> VerifyPhoneOtpAsync(string phone, string code, string? ipAddress);
        Task<AuthResponseDto?> GoogleLoginAsync(string credential, string? ipAddress);
    }

    /// <summary>
    /// Sign-in without a password: a one-time code sent by SMS, or a Google ID token. Both only ever sign in an EXISTING,
    /// active account (an admin creates accounts); nothing is created automatically. Failures all look the same to the
    /// caller so the endpoints cannot be used to find out which phone numbers or e-mail addresses are registered.
    /// </summary>
    public class ExternalLoginService : IExternalLoginService
    {
        internal const int CodeLength = 6;
        private readonly FraudGuardDbContext _db;
        private readonly IJwtTokenService _jwt;
        private readonly IAuditLogService _audit;
        private readonly ISmsSender _sms;
        private readonly IGoogleTokenVerifier _google;
        private readonly ILogger<ExternalLoginService> _logger;
        private readonly byte[] _pepper;
        private readonly string? _googleClientId;
        private readonly string _defaultCountryCode;
        private readonly TimeSpan _otpLifetime;
        private readonly int _maxAttempts;
        private readonly int _maxRequestsPer10Min;

        public ExternalLoginService(
            FraudGuardDbContext db,
            IJwtTokenService jwt,
            IAuditLogService audit,
            ISmsSender sms,
            IGoogleTokenVerifier google,
            IConfiguration config,
            ILogger<ExternalLoginService> logger)
        {
            _db = db;
            _jwt = jwt;
            _audit = audit;
            _sms = sms;
            _google = google;
            _logger = logger;
            _pepper = JwtKeyResolver.Resolve(config);
            var clientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? config["Google:ClientId"];
            _googleClientId = string.IsNullOrWhiteSpace(clientId) ? null : clientId.Trim();
            _defaultCountryCode = config["Auth:DefaultCountryCode"] is { Length: > 0 } cc ? cc : "+91";
            _otpLifetime = TimeSpan.FromMinutes(int.TryParse(config["Auth:OtpLifetimeMinutes"], out var m) && m > 0 ? m : 5);
            _maxAttempts = int.TryParse(config["Auth:OtpMaxAttempts"], out var a) && a > 0 ? a : 5;
            _maxRequestsPer10Min = int.TryParse(config["Auth:OtpMaxRequestsPer10Minutes"], out var r) && r > 0 ? r : 3;
        }

        public AuthConfigDto GetConfig() => new()
        {
            GoogleClientId = _googleClientId,
            PhoneLoginEnabled = _sms.Enabled,
            DefaultCountryCode = _defaultCountryCode
        };

        // ------------------------------------------------------------------ phone (SMS one-time code)
        public async Task<OtpRequestOutcome> RequestPhoneOtpAsync(string phone, string? ipAddress)
        {
            if (!_sms.Enabled) return OtpRequestOutcome.Disabled;
            var e164 = PhoneNumberNormalizer.Normalize(phone, _defaultCountryCode);
            if (e164 == null) return OtpRequestOutcome.InvalidPhone;

            var user = await _db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == e164 && u.IsActive);
            if (user == null)
            {
                await AuditAsync(PhoneNumberNormalizer.Mask(e164), "EXTERNAL", "OTP_REQUEST", "FAILED", "Phone number not registered", null, ipAddress);
                return OtpRequestOutcome.Accepted;          // same answer as for a registered number
            }

            var now = DateTimeOffset.UtcNow;
            var recent = await _db.LoginOtps.CountAsync(o => o.UserId == user.UserId && o.CreatedAt > now.AddMinutes(-10));
            if (recent >= _maxRequestsPer10Min)
            {
                await AuditAsync(user.FullName, user.Role, "OTP_REQUEST", "THROTTLED", "Too many code requests", user.UserId, ipAddress);
                return OtpRequestOutcome.Accepted;
            }

            // Only the newest code is valid
            var open = await _db.LoginOtps.Where(o => o.UserId == user.UserId && o.ConsumedAt == null).ToListAsync();
            foreach (var o in open) o.ConsumedAt = now;

            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D" + CodeLength);
            var otp = new LoginOtp { UserId = user.UserId, ExpiresAt = now.Add(_otpLifetime), CreatedAt = now };
            otp.CodeHash = Hash(otp.OtpId, code);
            _db.LoginOtps.Add(otp);
            await _db.SaveChangesAsync();

            try
            {
                await _sms.SendAsync(e164, $"Your FraudGuard AI sign-in code is {code}. It expires in {(int)_otpLifetime.TotalMinutes} minutes. Do not share it.");
                await AuditAsync(user.FullName, user.Role, "OTP_REQUEST", "SUCCESS", $"Code sent to {PhoneNumberNormalizer.Mask(e164)} via {_sms.ProviderName}", user.UserId, ipAddress);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not send the sign-in code by SMS");
                otp.ConsumedAt = DateTimeOffset.UtcNow;     // an unsent code must not stay usable
                await _db.SaveChangesAsync();
                await AuditAsync(user.FullName, user.Role, "OTP_REQUEST", "FAILED", "SMS provider error", user.UserId, ipAddress);
            }
            return OtpRequestOutcome.Accepted;
        }

        public async Task<AuthResponseDto?> VerifyPhoneOtpAsync(string phone, string code, string? ipAddress)
        {
            var e164 = PhoneNumberNormalizer.Normalize(phone, _defaultCountryCode);
            var clean = (code ?? string.Empty).Trim();
            if (e164 == null || clean.Length != CodeLength || !clean.All(char.IsAsciiDigit)) return null;

            var user = await _db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == e164 && u.IsActive);
            if (user == null)
            {
                await AuditAsync(PhoneNumberNormalizer.Mask(e164), "EXTERNAL", "LOGIN_FAILURE", "FAILED", "OTP: phone number not registered", null, ipAddress);
                return null;
            }
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                await AuditAsync(user.FullName, user.Role, "LOGIN_FAILURE", "LOCKED", "OTP: account locked", user.UserId, ipAddress);
                return null;
            }

            var now = DateTimeOffset.UtcNow;
            var otp = await _db.LoginOtps
                .Where(o => o.UserId == user.UserId && o.ConsumedAt == null && o.ExpiresAt > now)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();
            if (otp == null)
            {
                await AuditAsync(user.FullName, user.Role, "LOGIN_FAILURE", "FAILED", "OTP: no valid code (expired or not requested)", user.UserId, ipAddress);
                return null;
            }

            otp.Attempts++;
            var matches = CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(Hash(otp.OtpId, clean)), Encoding.ASCII.GetBytes(otp.CodeHash));
            if (!matches)
            {
                if (otp.Attempts >= _maxAttempts) otp.ConsumedAt = now;   // too many wrong guesses: this code is dead
                await _db.SaveChangesAsync();
                await AuditAsync(user.FullName, user.Role, "LOGIN_FAILURE", "FAILED",
                    $"OTP: wrong code ({otp.Attempts}/{_maxAttempts})", user.UserId, ipAddress);
                return null;
            }

            otp.ConsumedAt = now;                                         // single use
            return await SignInAsync(user, "phone code", ipAddress);
        }

        // ------------------------------------------------------------------ Google
        public async Task<AuthResponseDto?> GoogleLoginAsync(string credential, string? ipAddress)
        {
            if (_googleClientId == null || string.IsNullOrWhiteSpace(credential)) return null;

            var identity = await _google.VerifyAsync(credential, _googleClientId);
            if (identity == null || !identity.EmailVerified || string.IsNullOrWhiteSpace(identity.Email))
            {
                await AuditAsync("google", "EXTERNAL", "LOGIN_FAILURE", "FAILED", "Google token invalid or e-mail not verified", null, ipAddress);
                return null;
            }

            var email = identity.Email.Trim().ToLowerInvariant();
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive);
            if (user == null)
            {
                await AuditAsync(email.Length <= 100 ? email : email[..100], "EXTERNAL", "LOGIN_FAILURE", "FAILED", "Google account has no FraudGuard user", null, ipAddress);
                return null;
            }
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                await AuditAsync(user.FullName, user.Role, "LOGIN_FAILURE", "LOCKED", "Google: account locked", user.UserId, ipAddress);
                return null;
            }
            return await SignInAsync(user, "Google", ipAddress);
        }

        // ------------------------------------------------------------------ shared
        private async Task<AuthResponseDto> SignInAsync(User user, string method, string? ipAddress)
        {
            user.AccessFailedCount = 0;
            user.LockoutEnd = null;
            user.LastLoginAt = DateTimeOffset.UtcNow;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();

            var (token, expiresAt) = _jwt.GenerateToken(user);
            await AuditAsync(user.FullName, user.Role, "LOGIN_SUCCESS", "SUCCESS", $"Method: {method}; Role: {user.Role}", user.UserId, ipAddress);

            return new AuthResponseDto
            {
                Token = token,
                TokenType = "Bearer",
                ExpiresAt = expiresAt,
                User = new UserProfileDto
                {
                    UserId = user.UserId,
                    UserCode = user.UserCode,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role.ToUpperInvariant(),
                    Department = user.Department,
                    Initials = AuthService.ComputeInitials(user.FullName)
                }
            };
        }

        private Task AuditAsync(string actorName, string actorType, string action, string result, string detail, Guid? actorId, string? ip)
            => _audit.LogActivityAsync(
                actorName: actorName.Length <= 100 ? actorName : actorName[..100],   // AuditLogs.ActorName is NVARCHAR(100)
                actorType: actorType, action: action, resourceTarget: "Authentication", result: result,
                category: "Authentication", subAction: detail, actorId: actorId, ipAddress: ip);

        /// <summary>Keyed hash of the code (key = the server's JWT secret); the code itself is never stored.</summary>
        private string Hash(Guid otpId, string code)
            => Convert.ToHexString(HMACSHA256.HashData(_pepper, Encoding.UTF8.GetBytes($"{otpId:N}:{code}")));
    }
}
