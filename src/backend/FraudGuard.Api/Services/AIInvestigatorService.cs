using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.AIInvestigator;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services
{
    public class AIInvestigatorService : IAIInvestigatorService
    {
        private readonly FraudGuardDbContext _db;
        private readonly IFastApiClient _fastApiClient;
        private readonly IAuditLogService _auditLogService;
        private readonly ILogger<AIInvestigatorService> _logger;

        public AIInvestigatorService(
            FraudGuardDbContext db,
            IFastApiClient fastApiClient,
            IAuditLogService auditLogService,
            ILogger<AIInvestigatorService> logger)
        {
            _db = db;
            _fastApiClient = fastApiClient;
            _auditLogService = auditLogService;
            _logger = logger;
        }

        public async Task<InvestigationDetailFullDto> RunInvestigationAsync(
            InvestigateRequestDto request,
            Guid userId,
            string? ipAddress = null,
            CancellationToken cancellationToken = default)
        {
            var user = await _db.Users.FindAsync(new object[] { userId }, cancellationToken);
            var userName = user?.FullName ?? "Authorized Investigator";

            var txn = await _db.Transactions
                .Include(t => t.Customer)
                .Include(t => t.Merchant)
                .Include(t => t.Device)
                .Include(t => t.FraudPrediction)
                .FirstOrDefaultAsync(t => t.TransactionId == request.TransactionId, cancellationToken);

            if (txn == null)
            {
                throw new KeyNotFoundException($"Transaction with ID '{request.TransactionId}' was not found.");
            }

            var customer = txn.Customer;
            var account = await _db.Accounts.FirstOrDefaultAsync(a => a.AccountId == txn.AccountId, cancellationToken);

            // Compute historical frequency
            var cutoff = DateTimeOffset.UtcNow.AddHours(-24);
            var recentTxnCount = await _db.Transactions
                .CountAsync(t => t.CustomerId == txn.CustomerId && t.TransactionTimestamp >= cutoff, cancellationToken);

            var recentAlertsCount = await _db.FraudAlerts
                .CountAsync(a => a.CustomerId == txn.CustomerId && (a.Severity == "Critical" || a.Severity == "High"), cancellationToken);

            // Assemble context payload for FastAPI AI Engine
            var fastApiReq = new FastApiInvestigationRequest
            {
                TransactionId = txn.TransactionId.ToString(),
                TransactionCode = txn.TransactionCode,
                AlertId = request.AlertId?.ToString(),
                AmountInr = txn.AmountInr,
                AmountUsd = txn.AmountUsd,
                PaymentMethod = txn.PaymentMethod,
                MerchantName = txn.Merchant?.MerchantName ?? "Unknown Merchant",
                MerchantCategory = txn.Merchant?.Category ?? "Retail",
                City = txn.City,
                Country = txn.Country,
                DistanceFromTypicalKm = txn.DistanceFromTypicalKm,
                IpAddress = txn.IPAddress,
                VpnOrProxyDetected = txn.VPNOrProxyDetected,
                TorExitNode = txn.TorExitNode,
                DeviceType = txn.Device?.DeviceType,
                Os = txn.Device?.OperatingSystem,
                Browser = txn.Device?.Browser,
                IsEmulator = txn.Device?.IsEmulator,
                IsRootedOrJailbroken = txn.Device?.IsRootedOrJailbroken,
                CustomerId = customer?.CustomerId.ToString(),
                CustomerName = customer?.FullName,
                CustomerBaselineAvgAmount = customer?.BaselineAvgAmount,
                CustomerRolling30dVolume = customer?.Rolling30dVolume,
                CustomerRiskScore = customer?.RiskScore,
                CustomerRiskTier = customer?.RiskTier,
                CustomerPriorFlagsCount = customer?.PriorFlagsCount,
                AccountId = account?.AccountId.ToString(),
                AccountNumber = account?.AccountNumber,
                CurrentBalance = account?.CurrentBalance,
                DailyLimit = account?.DailyLimit,
                RecentTransactionsCount = recentTxnCount,
                RecentHighRiskAlertsCount = recentAlertsCount,
                ModelFraudProbability = txn.FraudPrediction?.FraudProbability,
                ModelRiskTier = txn.FraudPrediction?.RiskTier,
                ModelIsFraud = txn.FraudPrediction != null ? (txn.FraudPrediction.FraudProbability >= 80.0m) : null,
                Prompt = request.Prompt
            };

            // Call FastAPI microservice
            var aiResult = await _fastApiClient.InvestigateAsync(fastApiReq, cancellationToken);

            // Locate existing investigation or create new one
            var investigation = await _db.Investigations
                .Include(i => i.Evidence)
                .Include(i => i.Timeline)
                .FirstOrDefaultAsync(i => i.TransactionId == txn.TransactionId, cancellationToken);

            bool isNew = false;
            if (investigation == null)
            {
                isNew = true;
                var randSuffix = new Random().Next(100000, 999999);
                investigation = new Investigation
                {
                    InvestigationId = Guid.NewGuid(),
                    InvestigationCode = $"INV-{DateTime.UtcNow.Year}-{randSuffix}",
                    AlertId = request.AlertId,
                    TransactionId = txn.TransactionId,
                    CustomerId = txn.CustomerId,
                    AssignedInvestigatorId = userId,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _db.Investigations.Add(investigation);
            }

            investigation.Priority = aiResult.RiskTier == "CRITICAL" ? "Critical" : aiResult.RiskTier == "HIGH" ? "High" : "Medium";
            investigation.Status = "Investigating";
            investigation.ResolutionNotes = aiResult.Summary;
            investigation.UpdatedAt = DateTimeOffset.UtcNow;

            // Clear old evidence if regenerating
            if (!isNew && investigation.Evidence.Any())
            {
                _db.InvestigationEvidence.RemoveRange(investigation.Evidence);
            }

            // Persist synthesized evidence items
            foreach (var ev in aiResult.Evidence)
            {
                var categoryClean = NormalizeCategory(ev.Category);
                var severityClean = NormalizeSeverity(ev.Severity);

                var evidenceEntity = new InvestigationEvidence
                {
                    EvidenceId = Guid.NewGuid(),
                    InvestigationId = investigation.InvestigationId,
                    Category = categoryClean,
                    FindingType = ev.FindingType,
                    FindingDetail = ev.FindingDetail,
                    Confidence = ev.Confidence,
                    Severity = severityClean,
                    Source = ev.Source,
                    EvidenceTimestamp = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _db.InvestigationEvidence.Add(evidenceEntity);
            }

            // Clear old timeline if regenerating
            if (!isNew && investigation.Timeline.Any())
            {
                _db.InvestigationTimeline.RemoveRange(investigation.Timeline);
            }

            // Insert auditable 6-stage lifecycle timeline
            var now = DateTimeOffset.UtcNow;
            var timelineSteps = new List<InvestigationTimeline>
            {
                new()
                {
                    InvestigationId = investigation.InvestigationId,
                    StepNumber = 1,
                    Label = "Investigation Initiated",
                    Description = $"Agentic investigation dispatched by {userName}.",
                    Status = "completed",
                    ActorType = "human",
                    ActorName = userName,
                    StepTimestamp = now.AddSeconds(-5)
                },
                new()
                {
                    InvestigationId = investigation.InvestigationId,
                    StepNumber = 2,
                    Label = "Multi-Vector Evidence Collected",
                    Description = $"Collected {aiResult.Evidence.Count} evidence items across transaction, customer baseline, and device telemetry.",
                    Status = "completed",
                    ActorType = "ai",
                    ActorName = "FraudGuard Multi-Vector Collector",
                    StepTimestamp = now.AddSeconds(-4)
                },
                new()
                {
                    InvestigationId = investigation.InvestigationId,
                    StepNumber = 3,
                    Label = "Predictive Inference Analyzed",
                    Description = $"LightGBM model evaluated transaction: {aiResult.FraudProbability:F1}% fraud probability ({aiResult.RiskTier}).",
                    Status = "completed",
                    ActorType = "ai",
                    ActorName = "LightGBM AI Engine",
                    StepTimestamp = now.AddSeconds(-3)
                },
                new()
                {
                    InvestigationId = investigation.InvestigationId,
                    StepNumber = 4,
                    Label = "Policy Guidance Retrieved",
                    Description = $"Retrieved {aiResult.PolicyReferences.Count} relevant SOP and regulatory guidance chunks via local RAG.",
                    Status = "completed",
                    ActorType = "ai",
                    ActorName = "FraudGuard Policy RAG",
                    StepTimestamp = now.AddSeconds(-2)
                },
                new()
                {
                    InvestigationId = investigation.InvestigationId,
                    StepNumber = 5,
                    Label = "AI Synthesis Completed",
                    Description = $"Synthesized {aiResult.Findings.Count} risk findings. Factual context clearly distinguished from AI reasoning.",
                    Status = "completed",
                    ActorType = "ai",
                    ActorName = "Agentic Reasoning Engine",
                    StepTimestamp = now.AddSeconds(-1)
                },
                new()
                {
                    InvestigationId = investigation.InvestigationId,
                    StepNumber = 6,
                    Label = "Action Recommended",
                    Description = $"AI recommends: {aiResult.RecommendedAction} ({aiResult.Confidence * 100:F0}% confidence). Awaiting human investigator sign-off.",
                    Status = "active",
                    ActorType = "ai",
                    ActorName = "FraudGuard Copilot",
                    StepTimestamp = now
                }
            };
            _db.InvestigationTimeline.AddRange(timelineSteps);

            // Audit logging
            await _auditLogService.LogActivityAsync(
                actorName: userName,
                actorType: "AI AGENT",
                action: "INVESTIGATION_AI_ANALYZED",
                resourceTarget: $"Investigation:{investigation.InvestigationId}",
                result: "SUCCESS",
                category: "Investigation",
                subAction: $"Recommended: {aiResult.RecommendedAction} (Score: {aiResult.FraudProbability:F1}%)",
                actorId: userId,
                ipAddress: ipAddress
            );

            await _db.SaveChangesAsync(cancellationToken);

            return new InvestigationDetailFullDto
            {
                InvestigationId = investigation.InvestigationId,
                InvestigationCode = investigation.InvestigationCode,
                TransactionId = txn.TransactionId,
                TransactionCode = txn.TransactionCode,
                CustomerId = txn.CustomerId,
                CustomerName = customer?.FullName ?? "Unknown",
                AmountInr = txn.AmountInr,
                RiskTier = aiResult.RiskTier,
                FraudProbability = aiResult.FraudProbability,
                Status = investigation.Status,
                Priority = investigation.Priority,
                ResolutionDecision = investigation.ResolutionDecision,
                ResolutionNotes = investigation.ResolutionNotes,
                Summary = aiResult.Summary,
                RecommendedAction = aiResult.RecommendedAction,
                Confidence = aiResult.Confidence,
                Evidence = aiResult.Evidence,
                Findings = aiResult.Findings,
                PolicyReferences = aiResult.PolicyReferences,
                Timeline = timelineSteps.Select(t => new InvestigationTimelineDto
                {
                    TimelineId = t.TimelineId,
                    StepNumber = t.StepNumber,
                    Label = t.Label,
                    Description = t.Description,
                    Status = t.Status,
                    ActorType = t.ActorType,
                    ActorName = t.ActorName,
                    StepTimestamp = t.StepTimestamp
                }).ToList(),
                CreatedAt = investigation.CreatedAt,
                UpdatedAt = investigation.UpdatedAt
            };
        }

        public async Task<InvestigationDetailFullDto?> GetInvestigationByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var inv = await _db.Investigations
                .Include(i => i.Transaction)
                .Include(i => i.Customer)
                .Include(i => i.Evidence)
                .Include(i => i.Timeline)
                .FirstOrDefaultAsync(i => i.InvestigationId == id, cancellationToken);

            if (inv == null) return null;

            return MapToDetailDto(inv);
        }

        public async Task<List<EvidenceItemDto>> GetEvidenceByInvestigationIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var evidence = await _db.InvestigationEvidence
                .Where(e => e.InvestigationId == id)
                .OrderByDescending(e => e.Confidence)
                .ToListAsync(cancellationToken);

            return evidence.Select(e => new EvidenceItemDto
            {
                Id = e.EvidenceId.ToString().Substring(0, 8).ToUpper(),
                Category = e.Category,
                FindingType = e.FindingType,
                FindingDetail = e.FindingDetail,
                Confidence = e.Confidence,
                Severity = e.Severity,
                Source = e.Source
            }).ToList();
        }

        public async Task<List<InvestigationTimelineDto>> GetTimelineByInvestigationIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var timeline = await _db.InvestigationTimeline
                .Where(t => t.InvestigationId == id)
                .OrderBy(t => t.StepNumber)
                .ToListAsync(cancellationToken);

            return timeline.Select(t => new InvestigationTimelineDto
            {
                TimelineId = t.TimelineId,
                StepNumber = t.StepNumber,
                Label = t.Label,
                Description = t.Description,
                Status = t.Status,
                ActorType = t.ActorType,
                ActorName = t.ActorName,
                StepTimestamp = t.StepTimestamp
            }).ToList();
        }

        public async Task<InvestigationDetailFullDto> RegenerateInvestigationAsync(
            Guid id,
            Guid userId,
            string? ipAddress = null,
            CancellationToken cancellationToken = default)
        {
            var inv = await _db.Investigations.FindAsync(new object[] { id }, cancellationToken);
            if (inv == null)
            {
                throw new KeyNotFoundException($"Investigation with ID '{id}' was not found.");
            }

            return await RunInvestigationAsync(
                new InvestigateRequestDto { TransactionId = inv.TransactionId, AlertId = inv.AlertId },
                userId,
                ipAddress,
                cancellationToken
            );
        }

        private static string NormalizeCategory(string cat)
        {
            var valid = new[] { "Transaction", "Behavioral", "Device", "Location", "ML", "Policy" };
            var match = valid.FirstOrDefault(v => v.Equals(cat, StringComparison.OrdinalIgnoreCase));
            return match ?? "Transaction";
        }

        private static string NormalizeSeverity(string sev)
        {
            var valid = new[] { "critical", "high", "medium", "low", "info" };
            var match = valid.FirstOrDefault(v => v.Equals(sev, StringComparison.OrdinalIgnoreCase));
            return match ?? "medium";
        }

        private static InvestigationDetailFullDto MapToDetailDto(Investigation inv)
        {
            return new InvestigationDetailFullDto
            {
                InvestigationId = inv.InvestigationId,
                InvestigationCode = inv.InvestigationCode,
                TransactionId = inv.TransactionId,
                TransactionCode = inv.Transaction?.TransactionCode ?? "",
                CustomerId = inv.CustomerId,
                CustomerName = inv.Customer?.FullName ?? "Unknown",
                AmountInr = inv.Transaction?.AmountInr ?? 0m,
                RiskTier = inv.Priority.ToUpperInvariant(),
                FraudProbability = 85.0m,
                Status = inv.Status,
                Priority = inv.Priority,
                ResolutionDecision = inv.ResolutionDecision,
                ResolutionNotes = inv.ResolutionNotes,
                Summary = inv.ResolutionNotes ?? "Investigation ongoing.",
                RecommendedAction = "ESCALATE_FOR_MANUAL_REVIEW",
                Confidence = 0.88m,
                Evidence = inv.Evidence.Select(e => new EvidenceItemDto
                {
                    Id = e.EvidenceId.ToString().Substring(0, 8).ToUpper(),
                    Category = e.Category,
                    FindingType = e.FindingType,
                    FindingDetail = e.FindingDetail,
                    Confidence = e.Confidence,
                    Severity = e.Severity,
                    Source = e.Source
                }).ToList(),
                Timeline = inv.Timeline.OrderBy(t => t.StepNumber).Select(t => new InvestigationTimelineDto
                {
                    TimelineId = t.TimelineId,
                    StepNumber = t.StepNumber,
                    Label = t.Label,
                    Description = t.Description,
                    Status = t.Status,
                    ActorType = t.ActorType,
                    ActorName = t.ActorName,
                    StepTimestamp = t.StepTimestamp
                }).ToList(),
                CreatedAt = inv.CreatedAt,
                UpdatedAt = inv.UpdatedAt
            };
        }
    }
}
