using System;
using System.Net.Http;
using System.Threading.Tasks;
using Google.Apis.Auth;
using Microsoft.Extensions.Logging;

namespace FraudGuard.Api.Services.ExternalLogin
{
    /// <summary>The verified claims of a Google ID token.</summary>
    public sealed record GoogleIdentity(string Email, bool EmailVerified, string Subject);

    public interface IGoogleTokenVerifier
    {
        /// <summary>Checks signature, issuer, expiry and that the token was issued for <paramref name="clientId"/>. Null when invalid.</summary>
        Task<GoogleIdentity?> VerifyAsync(string idToken, string clientId);
    }

    public sealed class GoogleTokenVerifier : IGoogleTokenVerifier
    {
        private readonly ILogger<GoogleTokenVerifier> _logger;
        public GoogleTokenVerifier(ILogger<GoogleTokenVerifier> logger) => _logger = logger;

        public async Task<GoogleIdentity?> VerifyAsync(string idToken, string clientId)
        {
            try
            {
                var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { clientId }
                });
                return new GoogleIdentity(payload.Email ?? string.Empty, payload.EmailVerified, payload.Subject);
            }
            catch (InvalidJwtException ex)
            {
                _logger.LogInformation("Google ID token rejected: {Reason}", ex.Message);
                return null;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Could not reach Google to verify an ID token");
                return null;
            }
        }
    }
}
