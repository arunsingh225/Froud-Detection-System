using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Auth;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public interface IAuthService
    {
        Task<AuthResponseDto?> LoginAsync(LoginRequestDto request, string? ipAddress = null);
        Task<UserProfileDto?> GetUserProfileAsync(Guid userId);
        Task<List<UserDto>> GetAllUsersAsync();
        Task<UserDto> CreateUserAsync(CreateUserRequestDto request, Guid adminUserId, string? ipAddress = null);
        Task<(bool Success, string Message, UserDto? User)> UpdateUserRoleAsync(Guid userId, string newRole, Guid adminUserId, string? ipAddress = null);
        Task<(bool Success, string Message, UserDto? User)> UpdateUserStatusAsync(Guid userId, bool isActive, Guid adminUserId, string? ipAddress = null);
    }

    public class AuthService : IAuthService
    {
        private readonly FraudGuardDbContext _db;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly IAuditLogService _auditLogService;

        public AuthService(
            FraudGuardDbContext db,
            IJwtTokenService jwtTokenService,
            IPasswordHasher<User> passwordHasher,
            IAuditLogService auditLogService)
        {
            _db = db;
            _jwtTokenService = jwtTokenService;
            _passwordHasher = passwordHasher;
            _auditLogService = auditLogService;
        }

        public async Task<AuthResponseDto?> LoginAsync(LoginRequestDto request, string? ipAddress = null)
        {
            var emailClean = request.Email.Trim().ToLowerInvariant();
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == emailClean);

            if (user == null || !user.IsActive)
            {
                // Record failed login audit log without exposing if user exists
                await _auditLogService.LogActivityAsync(
                    actorName: request.Email,
                    actorType: "EXTERNAL",
                    action: "LOGIN_FAILURE",
                    resourceTarget: "Authentication",
                    result: "FAILED",
                    category: "Authentication",
                    subAction: "Invalid credentials or inactive account",
                    actorId: null,
                    ipAddress: ipAddress
                );
                return null;
            }

            // Check for active account lockout (SEC-CRIT-04 / PART 5)
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                await _auditLogService.LogActivityAsync(
                    actorName: user.FullName,
                    actorType: user.Role,
                    action: "LOGIN_FAILURE",
                    resourceTarget: "Authentication",
                    result: "LOCKED",
                    category: "Authentication",
                    subAction: $"Account locked until {user.LockoutEnd.Value:O} due to excessive failed attempts",
                    actorId: user.UserId,
                    ipAddress: ipAddress
                );
                return null;
            }

            // Verify password using PBKDF2 (Cryptographic hash verification only, no backdoors)
            bool passwordValid = false;
            try
            {
                var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
                if (verificationResult == PasswordVerificationResult.Success ||
                    verificationResult == PasswordVerificationResult.SuccessRehashNeeded)
                {
                    passwordValid = true;
                    if (verificationResult == PasswordVerificationResult.SuccessRehashNeeded)
                    {
                        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
                    }
                }
            }
            catch (FormatException)
            {
                passwordValid = false;
            }

            if (!passwordValid)
            {
                user.AccessFailedCount++;
                if (user.AccessFailedCount >= 5)
                {
                    user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
                }
                await _db.SaveChangesAsync();

                await _auditLogService.LogActivityAsync(
                    actorName: user.FullName,
                    actorType: user.Role,
                    action: "LOGIN_FAILURE",
                    resourceTarget: "Authentication",
                    result: "FAILED",
                    category: "Authentication",
                    subAction: user.AccessFailedCount >= 5
                        ? "Account locked for 15 minutes after 5 consecutive failed attempts"
                        : $"Failed password attempt ({user.AccessFailedCount}/5)",
                    actorId: user.UserId,
                    ipAddress: ipAddress
                );
                return null;
            }

            // Successful authentication resets lockout counters
            user.AccessFailedCount = 0;
            user.LockoutEnd = null;
            user.LastLoginAt = DateTimeOffset.UtcNow;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();

            // Generate real cryptographic JWT
            var (token, expiresAt) = _jwtTokenService.GenerateToken(user);

            // Audit successful login
            await _auditLogService.LogActivityAsync(
                actorName: user.FullName,
                actorType: user.Role == "ADMIN" ? "ADMIN" : "INVESTIGATOR",
                action: "LOGIN_SUCCESS",
                resourceTarget: "Authentication",
                result: "SUCCESS",
                category: "Authentication",
                subAction: $"Role: {user.Role}",
                actorId: user.UserId,
                ipAddress: ipAddress
            );

            var initials = ComputeInitials(user.FullName);

            var profile = new UserProfileDto
            {
                UserId = user.UserId,
                UserCode = user.UserCode,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role.ToUpperInvariant(),
                Department = user.Department,
                Initials = initials
            };

            return new AuthResponseDto
            {
                Token = token,
                TokenType = "Bearer",
                ExpiresAt = expiresAt,
                User = profile
            };
        }

        public async Task<UserProfileDto?> GetUserProfileAsync(Guid userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null || !user.IsActive) return null;

            return new UserProfileDto
            {
                UserId = user.UserId,
                UserCode = user.UserCode,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role.ToUpperInvariant(),
                Department = user.Department,
                Initials = ComputeInitials(user.FullName)
            };
        }

        public async Task<List<UserDto>> GetAllUsersAsync()
        {
            return await _db.Users
                .AsNoTracking()
                .OrderBy(u => u.FullName)
                .Select(u => new UserDto
                {
                    UserId = u.UserId,
                    UserCode = u.UserCode,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role.ToUpperInvariant(),
                    Department = u.Department,
                    IsActive = u.IsActive,
                    LastLoginAt = u.LastLoginAt,
                    CreatedAt = u.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<UserDto> CreateUserAsync(CreateUserRequestDto request, Guid adminUserId, string? ipAddress = null)
        {
            var emailClean = request.Email.Trim().ToLowerInvariant();
            var existing = await _db.Users.AnyAsync(u => u.Email.ToLower() == emailClean);
            if (existing)
            {
                throw new InvalidOperationException($"User with email '{request.Email}' already exists.");
            }

            var nextNum = await _db.Users.CountAsync() + 1;
            var userCode = $"USR-{request.Role.Substring(0, 3)}-{nextNum:D3}";

            var user = new User
            {
                UserId = Guid.NewGuid(),
                UserCode = userCode,
                FullName = request.FullName.Trim(),
                Email = emailClean,
                Role = request.Role.ToUpperInvariant(),
                Department = request.Department?.Trim(),
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            await _auditLogService.LogActivityAsync(
                actorName: "ADMIN",
                actorType: "ADMIN",
                action: "USER_CREATED",
                resourceTarget: $"User:{user.UserId}",
                result: "SUCCESS",
                category: "Policy Change",
                subAction: $"Created user {user.FullName} ({user.Role})",
                actorId: adminUserId,
                ipAddress: ipAddress
            );

            return new UserDto
            {
                UserId = user.UserId,
                UserCode = user.UserCode,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Department = user.Department,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt
            };
        }

        public async Task<(bool Success, string Message, UserDto? User)> UpdateUserRoleAsync(Guid userId, string newRole, Guid adminUserId, string? ipAddress = null)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null)
            {
                return (false, "User not found.", null);
            }

            var roleUpper = newRole.ToUpperInvariant();

            // Guard: Prevent removing the last active ADMIN
            if (user.Role == "ADMIN" && roleUpper != "ADMIN")
            {
                var remainingAdmins = await _db.Users.CountAsync(u => u.Role == "ADMIN" && u.IsActive && u.UserId != userId);
                if (remainingAdmins == 0)
                {
                    return (false, "Cannot change role of the last active administrator.", null);
                }
            }

            var oldRole = user.Role;
            user.Role = roleUpper;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();

            await _auditLogService.LogActivityAsync(
                actorName: "ADMIN",
                actorType: "ADMIN",
                action: "USER_ROLE_CHANGED",
                resourceTarget: $"User:{user.UserId}",
                result: "SUCCESS",
                category: "Policy Change",
                subAction: $"Changed role for {user.FullName} from {oldRole} to {roleUpper}",
                actorId: adminUserId,
                ipAddress: ipAddress
            );

            var dto = new UserDto
            {
                UserId = user.UserId,
                UserCode = user.UserCode,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Department = user.Department,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt
            };

            return (true, "User role updated successfully.", dto);
        }

        public async Task<(bool Success, string Message, UserDto? User)> UpdateUserStatusAsync(Guid userId, bool isActive, Guid adminUserId, string? ipAddress = null)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null)
            {
                return (false, "User not found.", null);
            }

            // Guard: Prevent deactivating the last active ADMIN
            if (user.Role == "ADMIN" && !isActive)
            {
                var remainingAdmins = await _db.Users.CountAsync(u => u.Role == "ADMIN" && u.IsActive && u.UserId != userId);
                if (remainingAdmins == 0)
                {
                    return (false, "Cannot deactivate the last active administrator.", null);
                }
            }

            user.IsActive = isActive;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();

            await _auditLogService.LogActivityAsync(
                actorName: "ADMIN",
                actorType: "ADMIN",
                action: "USER_STATUS_CHANGED",
                resourceTarget: $"User:{user.UserId}",
                result: "SUCCESS",
                category: "Policy Change",
                subAction: $"Set active status to {isActive} for {user.FullName}",
                actorId: adminUserId,
                ipAddress: ipAddress
            );

            var dto = new UserDto
            {
                UserId = user.UserId,
                UserCode = user.UserCode,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Department = user.Department,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt
            };

            return (true, "User status updated successfully.", dto);
        }

        private static string ComputeInitials(string fullName)
        {
            if (string.IsNullOrWhiteSpace(fullName)) return "FG";
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2)
            {
                return $"{char.ToUpper(parts[0][0])}{char.ToUpper(parts[1][0])}";
            }
            if (parts.Length == 1 && parts[0].Length >= 2)
            {
                return parts[0].Substring(0, 2).ToUpperInvariant();
            }
            return "FG";
        }
    }
}
