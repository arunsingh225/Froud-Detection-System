using System.Text;
using System.Text.RegularExpressions;

namespace FraudGuard.Api.Services.ExternalLogin
{
    /// <summary>Turns user input such as "98765 43210" or "+91-98765-43210" into E.164 ("+919876543210"), or null if it is not a phone number.</summary>
    public static class PhoneNumberNormalizer
    {
        private static readonly Regex E164 = new(@"^\+[1-9]\d{7,14}$", RegexOptions.Compiled);

        public static string? Normalize(string? raw, string defaultCountryCode = "+91")
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;

            var digits = new StringBuilder();
            var hasPlus = false;
            foreach (var ch in raw.Trim())
            {
                if (ch == '+' && digits.Length == 0 && !hasPlus) hasPlus = true;
                else if (ch >= '0' && ch <= '9') digits.Append(ch);
                else if (ch is ' ' or '-' or '(' or ')' or '.') continue;
                else return null;                      // letters or other symbols: not a phone number
            }

            var d = digits.ToString();
            string e164;
            if (hasPlus) e164 = "+" + d;
            else if (d.StartsWith("00")) e164 = "+" + d[2..];                      // international prefix
            else if (d.Length == 11 && d[0] == '0') e164 = defaultCountryCode + d[1..]; // national trunk prefix
            else if (d.Length == 10) e164 = defaultCountryCode + d;                // national number
            else if (d.Length > 10) e164 = "+" + d;                                // already carries a country code
            else return null;

            return E164.IsMatch(e164) ? e164 : null;
        }

        /// <summary>"+919876543210" becomes "**********3210", so logs and audit entries never hold the full number.</summary>
        public static string Mask(string e164)
            => string.IsNullOrEmpty(e164) || e164.Length <= 4 ? "****" : new string('*', e164.Length - 4) + e164[^4..];
    }
}
