using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FraudGuard.Api.DTOs.AIInvestigator;

namespace FraudGuard.Api.Services
{
    public interface IAIInvestigatorService
    {
        Task<InvestigationDetailFullDto> RunInvestigationAsync(InvestigateRequestDto request, Guid userId, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task<InvestigationDetailFullDto?> GetInvestigationByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<EvidenceItemDto>> GetEvidenceByInvestigationIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<InvestigationTimelineDto>> GetTimelineByInvestigationIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<InvestigationDetailFullDto> RegenerateInvestigationAsync(Guid id, Guid userId, string? ipAddress = null, CancellationToken cancellationToken = default);
    }
}
