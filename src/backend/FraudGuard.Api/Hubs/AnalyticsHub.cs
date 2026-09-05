using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FraudGuard.Api.Hubs
{
    [Authorize]
    public class AnalyticsHub : Hub
    {
        // Hub is strictly receive-only for clients.
        // Broadcasts are dispatched exclusively by authorized backend services via IHubContext<AnalyticsHub>.
    }
}
