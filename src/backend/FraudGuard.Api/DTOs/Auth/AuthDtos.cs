using System;
using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs.Auth
{
    public class LoginRequestDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class UserProfileDto
    {
        public Guid UserId { get; set; }
        public string UserCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Initials { get; set; } = string.Empty;
        public string? Department { get; set; }
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string TokenType { get; set; } = "Bearer";
        public DateTimeOffset ExpiresAt { get; set; }
        public UserProfileDto User { get; set; } = new UserProfileDto();
    }

    public class UserDto
    {
        public Guid UserId { get; set; }
        public string UserCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Department { get; set; }
        public bool IsActive { get; set; }
        public DateTimeOffset? LastLoginAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class CreateUserRequestDto
    {
        [Required, MinLength(2), MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [RegularExpression("^(ADMIN|INVESTIGATOR|COMPLIANCE)$", ErrorMessage = "Role must be ADMIN, INVESTIGATOR, or COMPLIANCE.")]
        public string Role { get; set; } = "INVESTIGATOR";

        public string? Department { get; set; }
    }

    public class UpdateUserRoleRequestDto
    {
        [Required]
        [RegularExpression("^(ADMIN|INVESTIGATOR|COMPLIANCE)$", ErrorMessage = "Role must be ADMIN, INVESTIGATOR, or COMPLIANCE.")]
        public string Role { get; set; } = string.Empty;
    }

    public class UpdateUserStatusRequestDto
    {
        public bool IsActive { get; set; }
    }
}
