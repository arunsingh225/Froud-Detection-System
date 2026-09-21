using System;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Centralized JWT signing key resolution.
    /// Priority: Environment variable → Configuration["JWT_SECRET_KEY"] → Configuration["Jwt:SecretKey"].
    /// Fails fast if the key is missing or too short, instead of silently falling back to a hardcoded dev key.
    /// </summary>
    public static class JwtKeyResolver
    {
        public static byte[] Resolve(IConfiguration config)
        {
            var key = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
                   ?? config["JWT_SECRET_KEY"]
                   ?? config["Jwt:SecretKey"];

            if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
                throw new InvalidOperationException(
                    "JWT signing key missing or shorter than 32 bytes. " +
                    "Development: run 'dotnet user-secrets set \"Jwt:SecretKey\" \"<your-key>\"'. " +
                    "Production: set the JWT_SECRET_KEY environment variable.");

            return Encoding.UTF8.GetBytes(key);
        }
    }
}
