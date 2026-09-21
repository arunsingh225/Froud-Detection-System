from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field("healthy", examples=["healthy"])
    service: str = Field("FraudGuard AI Engine", examples=["FraudGuard AI Engine"])
    model_loaded: bool = Field(..., examples=[True])
    timestamp: str = Field(..., examples=["2026-09-03T12:00:00Z"])


class ModelInfoResponse(BaseModel):
    """Trained model operational metadata."""
    model_name: str = Field(..., examples=["LightGBM_Fraud_Classifier"])
    model_version: str = Field("1.0", examples=["1.0"])
    roc_auc: Optional[float] = Field(None, examples=[0.9168], description="Null when not recorded in model metadata")
    pr_auc: Optional[float] = Field(None, examples=[0.5393], description="Null when not recorded in model metadata")
    threshold: float = Field(..., examples=[0.80])
    feature_count: int = Field(..., examples=[464])
    training_date: Optional[str] = Field(None, examples=["2026-09-03 07:11:40 UTC"])


class PredictionResponse(BaseModel):
    """Prediction assessment response schema."""
    request_id: str = Field(..., description="Unique distributed tracking ID (UUID v4)")
    fraud_probability: float = Field(..., ge=0.0, le=1.0, description="Model-inferred fraud posterior probability [0.0, 1.0]")
    risk_level: str = Field(..., description="Risk tier: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'")
    is_fraud: bool = Field(..., description="Binary decision based on recommended operating threshold")
    threshold: float = Field(..., description="Operating decision threshold applied")
    model_name: str = Field(..., description="Name of the scoring model")
    model_version: str = Field("1.0", description="Model release version")
    prediction_timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
