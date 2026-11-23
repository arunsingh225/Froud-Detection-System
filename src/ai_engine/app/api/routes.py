import json
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, status
from app.config import settings
from app.schemas.prediction import PredictionRequest
from app.schemas.response import PredictionResponse, HealthResponse, ModelInfoResponse
from app.services.model_service import model_service
from app.utils.request_id import generate_request_id
from app.logging_config import logger

router = APIRouter()


def _as_float(value):
    """Return float(value), or None when the metric was never recorded (never invent one)."""
    return float(value) if value is not None else None


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health and Readiness Check",
    tags=["System"]
)
def get_health() -> HealthResponse:
    """Check microservice uptime and verify that the LightGBM model is resident in memory."""
    return HealthResponse(
        status="healthy" if model_service.is_loaded else "degraded",
        service="FraudGuard AI Engine",
        model_loaded=model_service.is_loaded,
        timestamp=datetime.now(timezone.utc).isoformat()
    )


@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
    summary="Model Provenance & Metrics",
    tags=["Model"]
)
def get_model_info() -> ModelInfoResponse:
    """Retrieve operational specifications, benchmark performance metrics, and feature metadata."""
    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not yet initialized."
        )

    meta = model_service.metadata or {}
    holdout = {}
    holdout_path = settings.get_resolved_model_path().parent / "holdout_evaluation.json"
    if holdout_path.exists():
        holdout = json.loads(holdout_path.read_text(encoding="utf-8")).get("test_set", {}).get("raw", {})
    return ModelInfoResponse(
        model_name=model_service.model_name,
        model_version=model_service.model_version,
        roc_auc=_as_float(meta.get("roc_auc")),
        pr_auc=_as_float(meta.get("pr_auc")),
        threshold=model_service.threshold,
        feature_count=model_service.feature_count,
        training_date=meta.get("training_date"),
        calibration_method=(model_service.calibration or {}).get("method"),
        holdout_roc_auc=_as_float(holdout.get("roc_auc")),
        holdout_pr_auc=_as_float(holdout.get("pr_auc")),
    )


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Evaluate Transaction Fraud Risk",
    tags=["Inference"]
)
def predict_fraud(
    request: PredictionRequest,
    explain: bool = Query(False, description="Also return the top feature attributions (TreeSHAP)"),
    top_k: int = Query(5, ge=1, le=20, description="Number of attributions to return when explain=true"),
) -> PredictionResponse:
    """
    Score an incoming transaction in real-time. Returns fraud probability, 
    risk tier, binary intervention decision, and applied threshold.
    """
    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference engine is not ready. Model is unavailable."
        )

    req_id = generate_request_id()
    t_start = time.perf_counter()

    try:
        result = model_service.predict(request, explain=explain, top_k=top_k)
        latency_ms = round((time.perf_counter() - t_start) * 1000, 2)

        logger.info(
            f"Prediction [ID={req_id}]: Prob={result['fraud_probability']:.4f} "
            f"| Tier={result['risk_level']} | Fraud={result['is_fraud']} | Latency={latency_ms}ms"
        )

        return PredictionResponse(
            request_id=req_id,
            fraud_probability=result["fraud_probability"],
            raw_score=result["raw_score"],
            calibrated_probability=result["calibrated_probability"],
            risk_level=result["risk_level"],
            is_fraud=result["is_fraud"],
            threshold=result["threshold"],
            model_name=result["model_name"],
            model_version=result["model_version"],
            prediction_timestamp=datetime.now(timezone.utc).isoformat(),
            top_factors=result.get("top_factors"),
            base_value=result.get("base_value"),
        )

    except ValueError as ve:
        logger.error(f"Prediction Validation Error [ID={req_id}]: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Feature transformation error: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"Inference Failure [ID={req_id}]: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during fraud model inference."
        )
