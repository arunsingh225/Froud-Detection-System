using System.Collections.Generic;

namespace FraudGuard.Api.DTOs.Analytics
{
    /// <summary>One row of the precision breakdown.</summary>
    public class FeedbackBreakdownDto
    {
        public string Group { get; set; } = string.Empty;
        public int Labelled { get; set; }
        public int ConfirmedFraud { get; set; }
        /// <summary>Share of labelled alerts in this group that were real fraud (null when there are no labels).</summary>
        public decimal? PrecisionPercent { get; set; }
    }

    /// <summary>
    /// How well the alerts the system raised held up once analysts judged them. Only alerts are judged, so this measures
    /// precision of the alerts; recall (fraud that raised no alert) cannot be observed from these labels.
    /// </summary>
    public class FeedbackMetricsDto
    {
        public int ResolvedAlerts { get; set; }
        public int Labelled { get; set; }
        public int ConfirmedFraud { get; set; }
        public int FalsePositives { get; set; }
        public decimal? PrecisionPercent { get; set; }
        /// <summary>Below this many labels the precision is too noisy to rely on.</summary>
        public int MinLabelsForReliableMetric { get; set; } = 30;
        public bool Reliable { get; set; }
        public List<FeedbackBreakdownDto> BySeverity { get; set; } = new();
        public List<FeedbackBreakdownDto> ByProbabilityBand { get; set; } = new();
    }
}
