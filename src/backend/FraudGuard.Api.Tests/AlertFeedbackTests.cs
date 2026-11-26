using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class AlertFeedbackTests
    {
        private readonly FraudGuardDbContext _db = new(new DbContextOptionsBuilder<FraudGuardDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        private readonly Customer _customer = new() { CustomerCode = "CUS-F-1", FullName = "Feedback Customer", Email = "f@example.com" };
        private int _n;

        private FraudAlert AddAlert(string severity, decimal? probability, string? outcome, string status = "Open", string codePrefix = "ALT")
        {
            _n++;
            var txn = new Transaction { TransactionCode = $"TXN-F-{_n}", CustomerId = _customer.CustomerId, AmountInr = 1000, Status = "Pending Review" };
            if (probability.HasValue)
                txn.FraudPrediction = new FraudPrediction { TransactionId = txn.TransactionId, FraudProbability = probability.Value, RiskTier = severity, AnomalyReason = "x" };
            var alert = new FraudAlert
            {
                AlertCode = $"{codePrefix}-F-{_n}", TransactionId = txn.TransactionId, CustomerId = _customer.CustomerId,
                Severity = severity, AlertType = "Test", Reason = "r", Status = outcome != null ? "Resolved" : status,
                ResolutionOutcome = outcome, ResolvedAt = outcome != null ? DateTimeOffset.UtcNow : null
            };
            if (!_db.Customers.Any()) _db.Customers.Add(_customer);
            _db.Transactions.Add(txn);
            _db.FraudAlerts.Add(alert);
            _db.SaveChanges();
            return alert;
        }

        private AnalyticsService Analytics()
            => new(_db, new Mock<IFastApiClient>().Object, new MemoryCache(new MemoryCacheOptions()), NullLogger<AnalyticsService>.Instance);

        private FraudAlertService Alerts() => new(_db);

        // ------------------------------------------------------------------ resolving with a label
        [Fact]
        public async Task Resolving_stores_the_verdict_the_note_and_who_decided()
        {
            var alert = AddAlert("High", 85m, null);
            var analyst = Guid.NewGuid();

            Assert.True(await Alerts().ResolveAlertAsync(alert.AlertId, AlertOutcomes.FalsePositive, "  Customer confirmed the purchase  ", analyst));

            var saved = await _db.FraudAlerts.AsNoTracking().SingleAsync();
            Assert.Equal("Resolved", saved.Status);
            Assert.Equal(AlertOutcomes.FalsePositive, saved.ResolutionOutcome);
            Assert.Equal("Customer confirmed the purchase", saved.ResolutionNotes);
            Assert.Equal(analyst, saved.ResolvedByUserId);
            Assert.NotNull(saved.ResolvedAt);
        }

        [Theory]
        [InlineData("")]
        [InlineData("fraud")]
        [InlineData("confirmed_fraud")]      // the verdict must be exactly one of the two labels
        public async Task An_invalid_verdict_is_rejected_and_nothing_changes(string verdict)
        {
            var alert = AddAlert("High", 85m, null);
            await Assert.ThrowsAsync<ArgumentException>(() => Alerts().ResolveAlertAsync(alert.AlertId, verdict, null, null));
            Assert.Equal("Open", (await _db.FraudAlerts.AsNoTracking().SingleAsync()).Status);
        }

        [Fact]
        public async Task An_unknown_alert_is_reported_as_not_found()
            => Assert.False(await Alerts().ResolveAlertAsync(Guid.NewGuid(), AlertOutcomes.ConfirmedFraud, null, null));

        [Fact]
        public async Task The_verdict_is_part_of_the_alert_that_the_api_returns()
        {
            var alert = AddAlert("Critical", 95m, AlertOutcomes.ConfirmedFraud);
            Assert.Equal(AlertOutcomes.ConfirmedFraud, (await Alerts().GetAlertByIdAsync(alert.AlertId))!.Outcome);
        }

        // ------------------------------------------------------------------ metrics
        [Fact]
        public async Task With_no_labels_there_is_no_precision_and_it_is_not_called_reliable()
        {
            AddAlert("High", 80m, null);                        // open alerts do not count
            var m = await Analytics().GetFeedbackMetricsAsync();
            Assert.Equal(0, m.Labelled);
            Assert.Null(m.PrecisionPercent);
            Assert.False(m.Reliable);
            Assert.Empty(m.BySeverity);
        }

        [Fact]
        public async Task Precision_is_confirmed_fraud_over_labelled_alerts_overall_and_per_group()
        {
            AddAlert("Critical", 95m, AlertOutcomes.ConfirmedFraud);
            AddAlert("Critical", 92m, AlertOutcomes.ConfirmedFraud);
            AddAlert("High", 85m, AlertOutcomes.ConfirmedFraud);
            AddAlert("High", 83m, AlertOutcomes.FalsePositive);
            AddAlert("Medium", 60m, AlertOutcomes.FalsePositive);
            AddAlert("Medium", null, AlertOutcomes.FalsePositive);   // an alert without a stored model score
            AddAlert("Low", 30m, null, status: "Investigating");     // not labelled: ignored

            var m = await Analytics().GetFeedbackMetricsAsync();

            Assert.Equal(6, m.Labelled);
            Assert.Equal(3, m.ConfirmedFraud);
            Assert.Equal(3, m.FalsePositives);
            Assert.Equal(50.0m, m.PrecisionPercent);
            Assert.False(m.Reliable);                                   // far fewer than 30 labels
            Assert.Equal(new[] { "Critical", "High", "Medium" }, m.BySeverity.Select(b => b.Group));
            Assert.Equal(100.0m, m.BySeverity[0].PrecisionPercent);
            Assert.Equal(50.0m, m.BySeverity[1].PrecisionPercent);
            Assert.Equal(0.0m, m.BySeverity[2].PrecisionPercent);
            Assert.Equal(new[] { "90% and above", "80% to 90%", "50% to 80%", "No score" }, m.ByProbabilityBand.Select(b => b.Group));
            Assert.Equal(100.0m, m.ByProbabilityBand[0].PrecisionPercent);   // 95 and 92 were both fraud
            Assert.Equal(50.0m, m.ByProbabilityBand[1].PrecisionPercent);    // 85 fraud, 83 not
        }

        [Fact]
        public async Task Precision_is_marked_reliable_only_from_30_labels()
        {
            for (var i = 0; i < 29; i++) AddAlert("High", 85m, i % 2 == 0 ? AlertOutcomes.ConfirmedFraud : AlertOutcomes.FalsePositive);
            Assert.False((await Analytics().GetFeedbackMetricsAsync()).Reliable);
            AddAlert("High", 85m, AlertOutcomes.ConfirmedFraud);
            Assert.True((await Analytics().GetFeedbackMetricsAsync()).Reliable);
        }

        // ------------------------------------------------------------------ export
        [Fact]
        public async Task The_export_holds_the_labels_as_zeros_and_ones_and_leaves_out_free_text()
        {
            var fraud = AddAlert("Critical", 94.5m, AlertOutcomes.ConfirmedFraud);
            var fine = AddAlert("High", 81m, AlertOutcomes.FalsePositive);
            fine.ResolutionNotes = "=HYPERLINK(\"http://evil\")";
            AddAlert("Low", 20m, null);
            _db.SaveChanges();

            var csv = Encoding.UTF8.GetString(await Analytics().ExportFeedbackCsvAsync());
            var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries).Select(l => l.TrimEnd('\r')).ToList();

            Assert.Equal("AlertCode,TransactionCode,ResolvedAtUtc,Severity,RiskTier,ModelProbabilityPercent,Outcome,Label", lines[0]);
            Assert.Equal(3, lines.Count);                                          // header + the two labelled alerts
            Assert.Contains(lines, l => l.Contains(fraud.AlertCode) && l.Contains(",94.5") && l.EndsWith("CONFIRMED_FRAUD,1"));
            Assert.Contains(lines, l => l.Contains(fine.AlertCode) && l.EndsWith("FALSE_POSITIVE,0"));
            Assert.DoesNotContain("HYPERLINK", csv);                               // notes are never exported
        }
    }
}
