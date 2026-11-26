namespace FraudGuard.Api.Models
{
    /// <summary>The analyst's verdict when an alert is resolved. These labels are the ground truth for measuring the model.</summary>
    public static class AlertOutcomes
    {
        public const string ConfirmedFraud = "CONFIRMED_FRAUD";
        public const string FalsePositive = "FALSE_POSITIVE";
        public const string Pattern = "^(CONFIRMED_FRAUD|FALSE_POSITIVE)$";

        public static bool IsValid(string? value) => value == ConfirmedFraud || value == FalsePositive;
    }
}
