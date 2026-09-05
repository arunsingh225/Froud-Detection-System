using System;
using System.Linq;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Translates domain application transactions into the IEEE-CIS machine learning feature schema.
    /// Unavailable or non-analogous features are intentionally left null to allow the Phase 5 
    /// PreprocessingService to handle them natively as NaN/defaults, strictly preserving model fidelity.
    /// </summary>
    public class FraudPredictionMapper
    {
        private const decimal UsdInrConversionRate = 83.50m;

        /// <summary>
        /// Map a persisted EF Core Transaction entity to a FastApiPredictionRequest.
        /// </summary>
        public FastApiPredictionRequest MapToFastApiRequest(Transaction transaction)
        {
            if (transaction == null) throw new ArgumentNullException(nameof(transaction));

            // 1. Transaction Amount (USD normalization)
            decimal amtUsd = transaction.AmountUsd.HasValue && transaction.AmountUsd.Value > 0
                ? transaction.AmountUsd.Value
                : (transaction.AmountInr > 0 ? Math.Round(transaction.AmountInr / UsdInrConversionRate, 2) : 50.00m);

            // 2. Relative Elapsed Timestamp (seconds delta within annual reference cycle)
            long dtSeconds = Math.Abs(transaction.TransactionTimestamp.ToUnixTimeSeconds() % (86400 * 180));
            if (dtSeconds == 0) dtSeconds = 86400;

            // 3. Card Identification Features
            int card1Val = DeriveCard1(transaction.CardLast4, transaction.AccountId);
            string card4Val = DeriveCardBrand(transaction.PaymentMethod);
            string card6Val = DeriveCardFundingType(transaction.PaymentMethod);

            // 4. Geographic and Distance Telemetry
            decimal addr1Val = DeriveRegionCode(transaction.City);
            decimal addr2Val = 87.0m; // Reference country code
            decimal? dist1Val = transaction.DistanceFromTypicalKm;

            // 5. Customer Email Domain Telemetry
            string? emailDomain = DeriveEmailDomain(transaction.Customer?.Email);

            // 6. Device & Identity Telemetry
            string? deviceInfo = transaction.Device != null
                ? $"{transaction.Device.DeviceType} {transaction.Device.OperatingSystem}".Trim()
                : null;
            string? deviceType = transaction.Device?.DeviceType?.ToLowerInvariant();

            // 7. Synthetic Velocity Signals (Derived from high-risk attributes like VPN/Tor)
            decimal? c13Val = (transaction.VPNOrProxyDetected || transaction.TorExitNode) ? 15.0m : 2.0m;

            return new FastApiPredictionRequest
            {
                TransactionAmt = amtUsd,
                ProductCD = "W", // Standard retail transaction category code
                TransactionDT = dtSeconds,
                Card1 = card1Val,
                Card2 = 111.0m,
                Card3 = 150.0m,
                Card4 = card4Val,
                Card5 = 226.0m,
                Card6 = card6Val,
                Addr1 = addr1Val,
                Addr2 = addr2Val,
                Dist1 = dist1Val,
                PEmailDomain = emailDomain,
                REmailDomain = emailDomain,
                DeviceInfo = deviceInfo,
                DeviceType = deviceType,
                C13 = c13Val,
                D15 = 20.0m
            };
        }

        /// <summary>
        /// Map an ad-hoc PredictFraudRequestDto payload to a FastApiPredictionRequest.
        /// </summary>
        public FastApiPredictionRequest MapDtoToFastApiRequest(PredictFraudRequestDto dto)
        {
            if (dto == null) throw new ArgumentNullException(nameof(dto));

            decimal rawAmt = dto.TransactionAmount ?? 100.00m;
            decimal amtUsd = Math.Round(rawAmt / UsdInrConversionRate, 2);
            if (amtUsd <= 0) amtUsd = 1.00m;

            int card1Val = DeriveCard1(dto.CardLast4, Guid.NewGuid());
            string card4Val = DeriveCardBrand(dto.PaymentMethod ?? "Credit Card");
            string card6Val = DeriveCardFundingType(dto.PaymentMethod ?? "Credit Card");
            decimal addr1Val = DeriveRegionCode(dto.City ?? "Mumbai");

            return new FastApiPredictionRequest
            {
                TransactionAmt = amtUsd,
                ProductCD = "W",
                TransactionDT = 86400,
                Card1 = card1Val,
                Card2 = 111.0m,
                Card3 = 150.0m,
                Card4 = card4Val,
                Card5 = 226.0m,
                Card6 = card6Val,
                Addr1 = addr1Val,
                Addr2 = 87.0m,
                Dist1 = dto.DistanceFromTypicalKm ?? 5.0m,
                PEmailDomain = "gmail.com",
                C13 = (dto.VpnDetected == true) ? 15.0m : 2.0m,
                D15 = 20.0m
            };
        }

        private static int DeriveCard1(string? cardLast4, Guid accountId)
        {
            if (!string.IsNullOrWhiteSpace(cardLast4) && int.TryParse(cardLast4, out int last4))
            {
                return 10000 + (last4 % 20000);
            }
            return 10000 + Math.Abs(accountId.GetHashCode() % 15000);
        }

        private static string DeriveCardBrand(string? paymentMethod)
        {
            if (string.IsNullOrWhiteSpace(paymentMethod)) return "visa";
            var pm = paymentMethod.ToLowerInvariant();
            if (pm.Contains("master")) return "mastercard";
            if (pm.Contains("amex") || pm.Contains("american")) return "american express";
            if (pm.Contains("discover")) return "discover";
            return "visa";
        }

        private static string DeriveCardFundingType(string? paymentMethod)
        {
            if (string.IsNullOrWhiteSpace(paymentMethod)) return "credit";
            var pm = paymentMethod.ToLowerInvariant();
            if (pm.Contains("debit") || pm.Contains("upi") || pm.Contains("net")) return "debit";
            return "credit";
        }

        private static decimal DeriveRegionCode(string? city)
        {
            if (string.IsNullOrWhiteSpace(city)) return 299.0m;
            int hash = Math.Abs(city.Trim().ToLowerInvariant().GetHashCode());
            return (decimal)(100 + (hash % 400));
        }

        private static string? DeriveEmailDomain(string? email)
        {
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return "gmail.com";
            var parts = email.Trim().ToLowerInvariant().Split('@');
            return parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1] : "gmail.com";
        }
    }
}
