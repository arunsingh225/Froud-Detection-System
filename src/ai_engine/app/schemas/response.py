from typing import List, Optional
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
    calibration_method: Optional[str] = Field(None, examples=["isotonic_regression"])
    holdout_roc_auc: Optional[float] = Field(None, description="ROC-AUC on the held-out TEST half (models/holdout_evaluation.json)")
    holdout_pr_auc: Optional[float] = Field(None, description="PR-AUC on the held-out TEST half")


class FactorContribution(BaseModel):
    """One feature's TreeSHAP contribution to the raw model score (log-odds; positive = towards fraud)."""
    feature: str = Field(..., description="Model feature name (categorical features are integer-encoded)")
    value: Optional[float] = Field(None, description="Feature value fed to the model (null = missing)")
    contribution: float = Field(..., description="Log-odds contribution to the raw score")


class DriftFeature(BaseModel):
    feature: str
    psi: float = Field(..., description="Population Stability Index versus the reference distribution")
    status: str = Field(..., description="stable (<0.1), moderate (0.1-0.25) or significant (>0.25)")


class DriftReport(BaseModel):
    """Input drift of recent /predict traffic against the reference distribution."""
    status: str = Field(..., description="stable | moderate | significant | insufficient_data | unavailable")
    n_samples: int
    min_samples: int
    window: int
    max_psi: Optional[float] = None
    features: List[DriftFeature] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    """Prediction assessment response schema."""
    request_id: str = Field(..., description="Unique distributed tracking ID (UUID v4)")
    fraud_probability: float = Field(..., ge=0.0, le=1.0, description="UNCALIBRATED model score in [0, 1]. Class-weighted training inflates it, so use it for ranking and the existing tier/threshold policy, not as a real probability. See calibrated_probability.")
    raw_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Same value as fraud_probability, named for what it is.")
    calibrated_probability: Optional[float] = Field(None, ge=0.0, le=1.0, description="Isotonic-calibrated estimate of the true fraud probability (null if no calibrator is loaded). Held-out ECE 0.002 vs 0.168 raw.")
    risk_level: str = Field(..., description="Risk tier: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'")
    is_fraud: bool = Field(..., description="Binary decision based on recommended operating threshold")
    threshold: float = Field(..., description="Operating decision threshold applied")
    model_name: str = Field(..., description="Name of the scoring model")
    model_version: str = Field("1.0", description="Model release version")
    prediction_timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    top_factors: Optional[List[FactorContribution]] = Field(None, description="Top feature attributions; only present when explain=true")
    base_value: Optional[float] = Field(None, description="Log-odds bias; base_value + sum of ALL contributions = log-odds of raw_score")
