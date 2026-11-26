using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.Auth
{
    /// <summary>What the sign-in page may offer: public information only (the Google client id is not a secret).</summary>
    public class AuthConfigDto
    {
        public string? GoogleClientId { get; set; }
        public bool PhoneLoginEnabled { get; set; }
        public string DefaultCountryCode { get; set; } = "+91";
    }

    public class OtpRequestDto
    {
        [Required, MaxLength(32)]
        public string Phone { get; set; } = string.Empty;
    }

    public class OtpVerifyDto
    {
        [Required, MaxLength(32)]
        public string Phone { get; set; } = string.Empty;

        [Required, StringLength(6, MinimumLength = 6)]
        public string Code { get; set; } = string.Empty;
    }

    public class GoogleLoginRequestDto
    {
        /// <summary>The Google ID token ("credential") returned by Google Identity Services.</summary>
        [Required, MaxLength(4096)]
        public string Credential { get; set; } = string.Empty;
    }

    public class ChangePasswordRequestDto
    {
        [Required, MaxLength(128)]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required, MaxLength(128)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ResetPasswordRequestDto
    {
        [Required, MaxLength(128)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UpdateUserPhoneRequestDto
    {
        /// <summary>The new phone number; empty or null removes it.</summary>
        [MaxLength(32)]
        public string? Phone { get; set; }
    }
}
