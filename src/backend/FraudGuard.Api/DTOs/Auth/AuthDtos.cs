using System;
using System.ComponentModel.DataAnnotations;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.DTOs.Auth
{
    public class LoginRequestDto
    {
        [Required, EmailAddress, MaxLength(254)]
        public string Email { get; set; } = string.Empty;

        [Required, MaxLength(128)]
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

        [Required, EmailAddress, MaxLength(254)]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(8), MaxLength(128)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [RegularExpression(Roles.Pattern, ErrorMessage = "Role must be ADMIN, INVESTIGATOR, COMPLIANCE, ANALYST or VIEWER.")]
        public string Role { get; set; } = "INVESTIGATOR";

        [MaxLength(100)]
        public string? Department { get; set; }
    }

    public class UpdateUserRoleRequestDto
    {
        [Required]
        [RegularExpression(Roles.Pattern, ErrorMessage = "Role must be ADMIN, INVESTIGATOR, COMPLIANCE, ANALYST or VIEWER.")]
        public string Role { get; set; } = string.Empty;
    }

    public class UpdateUserStatusRequestDto
    {
        public bool IsActive { get; set; }
    }
}
