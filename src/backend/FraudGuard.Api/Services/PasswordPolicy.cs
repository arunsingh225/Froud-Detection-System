using System.Linq;

namespace FraudGuard.Api.Services
{
    /// <summary>The rules a new password must meet. The same rules apply when an admin creates an account, resets a password, or a user changes theirs.</summary>
    public static class PasswordPolicy
    {
        public const int MinLength = 8;
        public const int MaxLength = 128;

        /// <summary>Null when the password is acceptable, otherwise a message that says what to fix (never echoes the password).</summary>
        public static string? Validate(string? password, string? currentPassword = null)
        {
            if (string.IsNullOrEmpty(password) || password.Length < MinLength)
                return $"The password must be at least {MinLength} characters long.";
            if (password.Length > MaxLength)
                return $"The password must be at most {MaxLength} characters long.";
            if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
                return "The password must contain at least one letter and one number.";
            if (password.Trim().Length != password.Length)
                return "The password must not start or end with a space.";
            if (currentPassword != null && password == currentPassword)
                return "The new password must be different from the current one.";
            return null;
        }
    }
}
