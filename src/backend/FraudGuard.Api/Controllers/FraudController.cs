using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [Authorize]
    [EnableRateLimiting("fraud_policy")]
    public class FraudController : ControllerBase
    {
        private readonly IFastApiClient _fastApiClient;
        private readonly IFraudPredictionService _fraudPredictionService;

        public FraudController(
            IFastApiClient fastApiClient,
            IFraudPredictionService fraudPredictionService)
        {
            _fastApiClient = fastApiClient;
            _fraudPredictionService = fraudPredictionService;
        }

        /// <summary>
        /// Check operational health of the ASP.NET Core API and the FastAPI ML inference engine.
        /// </summary>
        [HttpGet("engine-health")]
        [Authorize(Roles = "ADMIN,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<EngineHealthDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<EngineHealthDto>), 503)]
        public async Task<IActionResult> GetEngineHealth(CancellationToken cancellationToken)
        {
            var fastApiHealth = await _fastApiClient.GetHealthAsync(cancellationToken);

            var isHealthy = fastApiHealth != null && fastApiHealth.ModelLoaded;
            var healthDto = new EngineHealthDto
            {
                AspNetCore = "healthy",
                FastApi = fastApiHealth != null ? fastApiHealth.Status : "unavailable",
                ModelLoaded = fastApiHealth?.ModelLoaded ?? false,
                CheckedAt = DateTimeOffset.UtcNow,
                Message = isHealthy
                    ? "Inference microservice is operational with resident LightGBM model."
                    : "Fraud detection engine is currently unavailable or initializing."
            };

            if (!isHealthy)
            {
                return StatusCode(503, ApiResponse<EngineHealthDto>.Fail(healthDto.Message ?? "Service Unavailable"));
            }

            return Ok(ApiResponse<EngineHealthDto>.Ok(healthDto));
        }

        /// <summary>
        /// Retrieve operational metadata, benchmark metrics, and decision thresholds for the active model.
        /// </summary>
        [HttpGet("model-info")]
        [Authorize(Roles = "ADMIN,COMPLIANCE")]
        [ProducesResponseType(typeof(ApiResponse<FraudModelInfoDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 503)]
        public async Task<IActionResult> GetModelInfo(CancellationToken cancellationToken)
        {
            var info = await _fastApiClient.GetModelInfoAsync(cancellationToken);
            if (info == null)
            {
                return StatusCode(503, ApiResponse<object>.Fail("Unable to retrieve model specifications from the inference engine."));
            }

            var dto = new FraudModelInfoDto
            {
                ModelName = info.ModelName,
                ModelVersion = info.ModelVersion,
                RocAuc = info.RocAuc,
                PrAuc = info.PrAuc,
                Threshold = info.Threshold,
                FeatureCount = info.FeatureCount,
                TrainingDate = info.TrainingDate
            };

            return Ok(ApiResponse<FraudModelInfoDto>.Ok(dto));
        }

        /// <summary>
        /// Execute real-time fraud assessment on a transaction, persist predictions, and trigger investigator alerts.
        /// </summary>
        [HttpPost("predict")]
        [Authorize(Roles = "ADMIN,INVESTIGATOR")]
        [ProducesResponseType(typeof(ApiResponse<FraudPredictionResultDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 400)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        [ProducesResponseType(typeof(ApiResponse<object>), 503)]
        public async Task<IActionResult> PredictFraud(
            [FromBody] PredictFraudRequestDto dto,
            CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Invalid transaction prediction request."));
            }

            try
            {
                var result = await _fraudPredictionService.PredictDirectAsync(dto, cancellationToken);
                return Ok(ApiResponse<FraudPredictionResultDto>.Ok(result, "Fraud assessment completed successfully."));
            }
            catch (ArgumentException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
            catch (System.Net.Http.HttpRequestException ex)
            {
                return StatusCode(503, ApiResponse<object>.Fail($"Inference engine error: {ex.Message}"));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.Fail($"Internal assessment failure: {ex.Message}"));
            }
        }
    }
}
