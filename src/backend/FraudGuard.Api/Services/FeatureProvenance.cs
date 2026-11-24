using System;
using System.Collections.Generic;
using FraudGuard.Api.DTOs.Fraud;

namespace FraudGuard.Api.Services
{
    /// <summary>
    /// Where a model input really came from. The model was trained on IEEE-CIS (Vesta e-commerce) features, which this
    /// application's transactions do not have, so <see cref="FraudPredictionMapper"/> fills many of them with
    /// constants or heuristics. Tagging every attribution makes that visible next to each score instead of hiding it.
    ///
    ///   transaction   the value comes from the transaction (or its customer/device) itself
    ///   approximated  derived heuristically from something we have (hashes, modulo time, flags as proxies)
    ///   placeholder   a constant the mapper always sends, carrying no information about this transaction
    ///   not_provided  the model received no value (missing)
    ///
    /// Keep in sync with FraudPredictionMapper (a test maps two different transactions and checks the placeholders
    /// really are constant and the transaction-derived inputs really vary).
    /// </summary>
    public static class FeatureProvenance
    {
        public const string Transaction = "transaction";
        public const string Approximated = "approximated";
        public const string Placeholder = "placeholder";
        public const string NotProvided = "not_provided";

        private static readonly HashSet<string> FromTransaction = new(StringComparer.OrdinalIgnoreCase)
        {
            "TransactionAmt", "TransactionAmt_log", "TransactionAmt_decimal", "TransactionAmt_is_round",
            "dist1", "dist1_isna",
            "P_emaildomain", "R_emaildomain", "P_emaildomain_frequency", "P_emaildomain_isna", "R_emaildomain_isna",
            "email_both_provided", "email_domain_match",
            "DeviceInfo", "DeviceType", "device_info_available", "has_identity",
            "card4", "card6", "card4_card6"
        };

        private static readonly HashSet<string> ConstantsSentByTheMapper = new(StringComparer.OrdinalIgnoreCase)
        {
            "card2", "card3", "card5", "addr2", "ProductCD", "D15",
            "card1_card2", "card1_card3", "card1_card5", "card1_card2_frequency"
        };

        public static string Classify(string feature, double? value)
        {
            if (value == null) return NotProvided;
            if (ConstantsSentByTheMapper.Contains(feature)) return Placeholder;
            if (FromTransaction.Contains(feature)) return Transaction;
            return Approximated;   // card1 (hash), addr1 (hash of city), TransactionDT and its derived time features, C13 (VPN proxy), ...
        }

        /// <summary>Returns a copy of the factors with <c>Provenance</c> set.</summary>
        public static List<FactorContributionDto>? Annotate(List<FactorContributionDto>? factors)
        {
            if (factors == null) return null;
            var result = new List<FactorContributionDto>(factors.Count);
            foreach (var f in factors)
                result.Add(new FactorContributionDto
                {
                    Feature = f.Feature, Value = f.Value, Contribution = f.Contribution,
                    Provenance = Classify(f.Feature, f.Value)
                });
            return result;
        }
    }
}
