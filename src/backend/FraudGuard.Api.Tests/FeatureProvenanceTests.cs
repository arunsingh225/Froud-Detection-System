using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json.Serialization;
using FraudGuard.Api.DTOs.FastApi;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class FeatureProvenanceTests
    {
        [Theory]
        [InlineData("TransactionAmt", 4999.0, FeatureProvenance.Transaction)]
        [InlineData("dist1", 12.0, FeatureProvenance.Transaction)]
        [InlineData("card6", 1.0, FeatureProvenance.Transaction)]
        [InlineData("P_emaildomain", 3.0, FeatureProvenance.Transaction)]
        [InlineData("card2", 111.0, FeatureProvenance.Placeholder)]
        [InlineData("D15", 20.0, FeatureProvenance.Placeholder)]
        [InlineData("ProductCD", 0.0, FeatureProvenance.Placeholder)]
        [InlineData("card1_card2", 17.0, FeatureProvenance.Placeholder)]
        [InlineData("card1", 12345.0, FeatureProvenance.Approximated)]
        [InlineData("TransactionDT", 86400.0, FeatureProvenance.Approximated)]
        [InlineData("C13", 15.0, FeatureProvenance.Approximated)]
        [InlineData("V258", 1.0, FeatureProvenance.Approximated)]          // unknown but present: never claimed as real
        public void Classify_ByFeatureName(string feature, double value, string expected) =>
            Assert.Equal(expected, FeatureProvenance.Classify(feature, value));

        [Theory]
        [InlineData("TransactionAmt")]
        [InlineData("card2")]
        [InlineData("id_30")]
        public void ADefinedMissingValue_IsAlwaysNotProvided(string feature) =>
            Assert.Equal(FeatureProvenance.NotProvided, FeatureProvenance.Classify(feature, null));

        [Fact]
        public void Annotate_KeepsTheNumbers_AndHandlesNull()
        {
            var factors = new List<FactorContributionDto>
            {
                new() { Feature = "TransactionAmt", Value = 50, Contribution = 1.5 },
                new() { Feature = "C13", Value = null, Contribution = -0.2 }
            };
            var annotated = FeatureProvenance.Annotate(factors)!;
            Assert.Equal(new[] { "transaction", "not_provided" }, annotated.Select(f => f.Provenance));
            Assert.Equal(1.5, annotated[0].Contribution);
            Assert.Null(FeatureProvenance.Annotate(null));
        }

        // ---- the list must match what the mapper really does -------------------------------------------------

        private static Transaction Txn(decimal amount, string city, string method, string last4, double? km, bool vpn,
                                       string device, string email)
        {
            var accountId = Guid.NewGuid();
            return new Transaction
            {
                TransactionCode = "T-" + Guid.NewGuid().ToString("N")[..6], AccountId = accountId,
                AmountInr = amount, City = city, Country = "India", PaymentMethod = method, CardLast4 = last4,
                DistanceFromTypicalKm = km.HasValue ? (decimal)km.Value : null, VPNOrProxyDetected = vpn,
                TransactionTimestamp = DateTimeOffset.UtcNow.AddDays(-Random.Shared.Next(1, 200)).AddMinutes(Random.Shared.Next(0, 1000)),
                Customer = new Customer { Email = email },
                Device = new Device { DeviceType = device, OperatingSystem = device == "Mobile" ? "Android" : "Windows" }
            };
        }

        private static Dictionary<string, object?> Inputs(FastApiPredictionRequest r) =>
            typeof(FastApiPredictionRequest).GetProperties()
                .Where(p => p.GetCustomAttribute<JsonPropertyNameAttribute>() != null)
                .ToDictionary(p => p.GetCustomAttribute<JsonPropertyNameAttribute>()!.Name, p => p.GetValue(r));

        [Fact]
        public void PlaceholderList_MatchesTheConstantsTheMapperActuallySends()
        {
            var mapper = new FraudPredictionMapper();
            var requests = new[]
            {
                Txn(850000m, "Tbilisi", "Visa Credit", "9988", 5200, true, "Mobile", "a@gmail.com"),
                Txn(1200m, "Pune", "Mastercard Debit", "1234", 3, false, "Desktop", "b@outlook.com"),
                Txn(33000m, "Chennai", "UPI", "5555", 140, false, "Mobile", "c@yahoo.com")
            }.Select(mapper.MapToFastApiRequest).Select(Inputs).ToList();

            var constants = new List<string>();
            var varying = new List<string>();
            foreach (var key in requests[0].Keys)
            {
                var values = requests.Select(r => r[key]).ToList();
                var distinct = values.Select(v => v?.ToString()).Distinct().Count();
                if (values.All(v => v != null) && distinct == 1) constants.Add(key); else if (distinct > 1) varying.Add(key);
            }

            // Everything the mapper sends as a constant must be tagged placeholder (TransactionDT varies by timestamp
            // and is therefore "approximated", not a constant).
            foreach (var feature in constants)
                Assert.True(FeatureProvenance.Classify(feature, 1.0) == FeatureProvenance.Placeholder,
                    $"'{feature}' is a constant sent by the mapper but is not classified as a placeholder");

            // ...and nothing that varies with the transaction may be called a placeholder.
            foreach (var feature in varying)
                Assert.True(FeatureProvenance.Classify(feature, 1.0) != FeatureProvenance.Placeholder,
                    $"'{feature}' varies between transactions but is classified as a placeholder");

            // Sanity: the known constants really are in the detected set.
            Assert.Superset(new HashSet<string> { "card2", "card3", "card5", "addr2", "ProductCD", "D15" }, new HashSet<string>(constants.Where(c => new[] { "card2", "card3", "card5", "addr2", "ProductCD", "D15" }.Contains(c))));
            Assert.Contains("TransactionAmt", varying);
        }
    }
}
