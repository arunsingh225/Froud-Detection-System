using System;

namespace FraudGuard.Api.Models
{
    /// <summary>
    /// Threat categories stored in <c>FraudAlerts.Category</c>. Each alert has exactly one category
    /// (first matching rule wins, in the order below). The SQL backfill in
    /// <c>sql/06_alert_category.sql</c> implements the same rules; keep them in sync.
    /// </summary>
    public static class AlertCategories
    {
        public const string AccountTakeover = "AccountTakeover";
        public const string VelocitySpike = "VelocitySpike";
        public const string SyntheticIdentity = "SyntheticIdentity";
        public const string CardTesting = "CardTesting";
        public const string Other = "Other";

        public static readonly string[] All =
            { AccountTakeover, VelocitySpike, SyntheticIdentity, CardTesting, Other };

        public static string Classify(string? alertType, string? reason)
        {
            alertType ??= string.Empty;
            reason ??= string.Empty;

            if (Has(alertType, "Takeover") || Has(reason, "Device") || Has(reason, "Root")) return AccountTakeover;
            if (Has(alertType, "Velocity") || Has(reason, "Velocity")) return VelocitySpike;
            if (Has(alertType, "Synthetic") || Has(reason, "Synthetic") || Has(reason, "AML")) return SyntheticIdentity;
            if (Has(alertType, "Auth") || Has(reason, "Auth") || Has(reason, "PIN")) return CardTesting;
            return Other;
        }

        // Case-insensitive, like SQL Server's default collation used by the backfill script.
        private static bool Has(string text, string term) => text.Contains(term, StringComparison.OrdinalIgnoreCase);
    }
}
