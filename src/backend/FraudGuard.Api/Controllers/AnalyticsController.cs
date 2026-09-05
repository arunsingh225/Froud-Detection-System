using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Analytics;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analyticsService;

        public AnalyticsController(IAnalyticsService analyticsService)
        {
            _analyticsService = analyticsService;
        }

        [HttpGet("dashboard")]
        [ProducesResponseType(typeof(ApiResponse<AdvancedDashboardKpisDto>), 200)]
        public async Task<IActionResult> GetDashboardKpis()
        {
            var kpis = await _analyticsService.GetDashboardKpisAsync();
            return Ok(ApiResponse<AdvancedDashboardKpisDto>.Ok(kpis));
        }

        [HttpGet("fraud-trends")]
        [ProducesResponseType(typeof(ApiResponse<FraudTrendResponseDto>), 200)]
        public async Task<IActionResult> GetFraudTrends([FromQuery] string period = "7d")
        {
            var trends = await _analyticsService.GetFraudTrendsAsync(period);
            return Ok(ApiResponse<FraudTrendResponseDto>.Ok(trends));
        }

        [HttpGet("risk-distribution")]
        [ProducesResponseType(typeof(ApiResponse<RiskDistributionDto>), 200)]
        public async Task<IActionResult> GetRiskDistribution()
        {
            var dist = await _analyticsService.GetRiskDistributionAsync();
            return Ok(ApiResponse<RiskDistributionDto>.Ok(dist));
        }

        [HttpGet("fraud-by-category")]
        [ProducesResponseType(typeof(ApiResponse<List<CategoryRiskDto>>), 200)]
        public async Task<IActionResult> GetFraudByCategory()
        {
            var categories = await _analyticsService.GetCategoryRiskAsync();
            return Ok(ApiResponse<List<CategoryRiskDto>>.Ok(categories));
        }

        [HttpGet("geographic-risk")]
        [ProducesResponseType(typeof(ApiResponse<List<GeographicRiskDto>>), 200)]
        public async Task<IActionResult> GetGeographicRisk()
        {
            var geo = await _analyticsService.GetGeographicRiskAsync();
            return Ok(ApiResponse<List<GeographicRiskDto>>.Ok(geo));
        }

        [HttpGet("merchant-risk")]
        [ProducesResponseType(typeof(ApiResponse<List<MerchantRiskDto>>), 200)]
        public async Task<IActionResult> GetMerchantRisk()
        {
            var merchants = await _analyticsService.GetMerchantRiskAsync();
            return Ok(ApiResponse<List<MerchantRiskDto>>.Ok(merchants));
        }

        [HttpGet("customer-risk")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<CustomerRiskDto>>), 200)]
        public async Task<IActionResult> GetCustomerRisk([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var customers = await _analyticsService.GetCustomerRiskAsync(page, pageSize);
            return Ok(ApiResponse<PagedResult<CustomerRiskDto>>.Ok(customers));
        }

        [HttpGet("device-risk")]
        [ProducesResponseType(typeof(ApiResponse<List<DeviceRiskDto>>), 200)]
        public async Task<IActionResult> GetDeviceRisk()
        {
            var devices = await _analyticsService.GetDeviceRiskAsync();
            return Ok(ApiResponse<List<DeviceRiskDto>>.Ok(devices));
        }

        [HttpGet("alerts")]
        [ProducesResponseType(typeof(ApiResponse<AlertAnalyticsDto>), 200)]
        public async Task<IActionResult> GetAlertAnalytics()
        {
            var alerts = await _analyticsService.GetAlertAnalyticsAsync();
            return Ok(ApiResponse<AlertAnalyticsDto>.Ok(alerts));
        }

        [HttpGet("investigations")]
        [ProducesResponseType(typeof(ApiResponse<InvestigationAnalyticsDto>), 200)]
        public async Task<IActionResult> GetInvestigationAnalytics()
        {
            var invs = await _analyticsService.GetInvestigationAnalyticsAsync();
            return Ok(ApiResponse<InvestigationAnalyticsDto>.Ok(invs));
        }

        [HttpGet("model-monitoring")]
        [ProducesResponseType(typeof(ApiResponse<ModelMonitoringDto>), 200)]
        public async Task<IActionResult> GetModelMonitoring()
        {
            var model = await _analyticsService.GetModelMonitoringAsync();
            return Ok(ApiResponse<ModelMonitoringDto>.Ok(model));
        }

        [HttpGet("live-alerts")]
        [ProducesResponseType(typeof(ApiResponse<List<LiveAlertDto>>), 200)]
        public async Task<IActionResult> GetLiveAlerts([FromQuery] int limit = 10)
        {
            var alerts = await _analyticsService.GetLiveAlertsAsync(limit);
            return Ok(ApiResponse<List<LiveAlertDto>>.Ok(alerts));
        }

        [HttpGet("operational-health")]
        [ProducesResponseType(typeof(ApiResponse<OperationalHealthDto>), 200)]
        public async Task<IActionResult> GetOperationalHealth()
        {
            var health = await _analyticsService.GetOperationalHealthAsync();
            return Ok(ApiResponse<OperationalHealthDto>.Ok(health));
        }

        [HttpGet("export")]
        [Authorize(Roles = "ADMIN,COMPLIANCE,INVESTIGATOR")]
        [ProducesResponseType(typeof(FileContentResult), 200)]
        public async Task<IActionResult> ExportData([FromQuery] string type = "fraud-alerts", [FromQuery] string format = "csv")
        {
            var csvBytes = await _analyticsService.ExportDataCsvAsync(type);
            var filename = $"fraudguard_{type}_{System.DateTime.UtcNow:yyyyMMdd_HHmm}.csv";
            return File(csvBytes, "text/csv", filename);
        }

        // Backward compatibility
        [HttpGet("risk-trends")]
        public async Task<IActionResult> GetRiskTrends()
        {
            var trends = await _analyticsService.GetRiskTrendsAsync();
            return Ok(ApiResponse<List<RiskTrendPointDto>>.Ok(trends));
        }

        [HttpGet("mcc-breakdown")]
        public async Task<IActionResult> GetMccBreakdown()
        {
            var breakdown = await _analyticsService.GetMccBreakdownAsync();
            return Ok(ApiResponse<List<MccRiskItemDto>>.Ok(breakdown));
        }

        [HttpGet("telemetry")]
        public async Task<IActionResult> GetModelTelemetry()
        {
            var telemetry = await _analyticsService.GetModelTelemetryAsync();
            return Ok(ApiResponse<ModelTelemetryDto>.Ok(telemetry));
        }
    }
}
