import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from app.schemas.prediction import PredictionRequest
from app.schemas.response import PredictionResponse, HealthResponse, ModelInfoResponse
from app.services.model_service import model_service
from app.utils.request_id import generate_request_id
from app.logging_config import logger

router = APIRouter()


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
    return ModelInfoResponse(
        model_name=model_service.model_name,
        model_version=model_service.model_version,
        roc_auc=float(meta.get("roc_auc", 0.9168)),
        pr_auc=float(meta.get("pr_auc", 0.5393)),
        threshold=model_service.threshold,
        feature_count=model_service.feature_count,
        training_date=meta.get("training_date")
    )


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Evaluate Transaction Fraud Risk",
    tags=["Inference"]
)
def predict_fraud(request: PredictionRequest) -> PredictionResponse:
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
        result = model_service.predict(request)
        latency_ms = round((time.perf_counter() - t_start) * 1000, 2)

        logger.info(
            f"Prediction [ID={req_id}]: Prob={result['fraud_probability']:.4f} "
            f"| Tier={result['risk_level']} | Fraud={result['is_fraud']} | Latency={latency_ms}ms"
        )

        return PredictionResponse(
            request_id=req_id,
            fraud_probability=result["fraud_probability"],
            risk_level=result["risk_level"],
            is_fraud=result["is_fraud"],
            threshold=result["threshold"],
            model_name=result["model_name"],
            model_version=result["model_version"],
            prediction_timestamp=datetime.now(timezone.utc).isoformat()
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
