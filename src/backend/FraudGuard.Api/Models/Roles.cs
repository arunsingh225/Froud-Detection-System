namespace FraudGuard.Api.Models
{
    /// <summary>
    /// Single source of truth for all valid user roles in the system.
    /// Must match: DB CHECK constraint, DTO validation regex, controller [Authorize] policies,
    /// seed SQL data, Angular UserRole type, and README documentation.
    /// </summary>
    public static class Roles
    {
        public const string Admin = "ADMIN";
        public const string Investigator = "INVESTIGATOR";
        public const string Compliance = "COMPLIANCE";
        public const string Analyst = "ANALYST";
        public const string Viewer = "VIEWER";

        public static readonly string[] All = { Admin, Investigator, Compliance, Analyst, Viewer };

        /// <summary>Regex pattern for DTO validation attributes.</summary>
        public const string Pattern = "^(ADMIN|INVESTIGATOR|COMPLIANCE|ANALYST|VIEWER)$";
    }
}
