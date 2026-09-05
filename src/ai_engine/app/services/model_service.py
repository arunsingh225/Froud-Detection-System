import hashlib
import json
import joblib
from pathlib import Path
from typing import Dict, Any, Optional
import lightgbm as lgb
import pandas as pd

from app.config import settings
from app.logging_config import logger
from app.services.preprocessing_service import PreprocessingService
from app.services.risk_service import RiskService
from app.schemas.prediction import PredictionRequest


class ModelIntegrityError(Exception):
    """Raised when an ML artifact fails cryptographic integrity or signature verification."""
    pass


def calculate_sha256(file_path: Path) -> str:
    """Compute cryptographic SHA-256 digest of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class ModelService:
    """
    Singleton AI inference service managing the production LightGBM model,
    preprocessing pipeline, and operational risk assessment.
    """

    def __init__(self):
        self.model: Optional[lgb.LGBMClassifier] = None
        self.preprocessing_bundle: Optional[Dict[str, Any]] = None
        self.metadata: Optional[Dict[str, Any]] = None
        self.preprocessing_service: Optional[PreprocessingService] = None
        self.threshold: float = 0.80
        self.model_name: str = "LightGBM"
        self.model_version: str = "1.0"
        self.feature_count: int = 464
        self.is_loaded: bool = False

    def load(self) -> None:
        """Load trained model, preprocessing bundle, and metadata from disk after SHA-256 verification."""
        model_path = settings.get_resolved_model_path()
        preproc_path = settings.get_resolved_preprocessing_path()
        metadata_path = settings.get_resolved_metadata_path()
        manifest_path = settings.get_resolved_manifest_path()

        logger.info(f"Loading model artifacts from: {model_path.parent}")

        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found at: {model_path}")
        if not preproc_path.exists():
            raise FileNotFoundError(f"Preprocessing bundle not found at: {preproc_path}")
        if not manifest_path.exists():
            raise FileNotFoundError(
                f"Model integrity manifest not found at: {manifest_path}. "
                "Refusing to load untrusted machine learning artifacts."
            )

        # Cryptographic Integrity Verification (SEC-CRIT-02)
        with open(manifest_path, "r", encoding="utf-8") as mf:
            manifest = json.load(mf)

        # Verify fraud_model.pkl SHA-256
        expected_model_hash = manifest.get(model_path.name, {}).get("sha256")
        if not expected_model_hash:
            raise ModelIntegrityError(f"Integrity manifest is missing entry for {model_path.name}")
        actual_model_hash = calculate_sha256(model_path)
        if actual_model_hash.lower() != expected_model_hash.lower():
            raise ModelIntegrityError(
                f"CRITICAL SECURITY ALERT: SHA-256 mismatch for {model_path.name}! "
                f"Expected {expected_model_hash}, but computed {actual_model_hash}. "
                "Artifact may have been tampered with or corrupted. Loading aborted."
            )

        # Verify preprocessing.pkl SHA-256
        expected_preproc_hash = manifest.get(preproc_path.name, {}).get("sha256")
        if not expected_preproc_hash:
            raise ModelIntegrityError(f"Integrity manifest is missing entry for {preproc_path.name}")
        actual_preproc_hash = calculate_sha256(preproc_path)
        if actual_preproc_hash.lower() != expected_preproc_hash.lower():
            raise ModelIntegrityError(
                f"CRITICAL SECURITY ALERT: SHA-256 mismatch for {preproc_path.name}! "
                f"Expected {expected_preproc_hash}, but computed {actual_preproc_hash}. "
                "Artifact may have been tampered with or corrupted. Loading aborted."
            )

        logger.info("Cryptographic model integrity verified against manifest: SHA-256 signatures match.")

        # 1. Load trained LightGBM model
        logger.info(f"Loading LightGBM model from {model_path.name}...")
        self.model = joblib.load(model_path)
        if not hasattr(self.model, "predict_proba"):
            raise ValueError(f"Loaded object from {model_path} does not implement predict_proba()")

        # 2. Load Preprocessing Bundle
        logger.info(f"Loading preprocessing bundle from {preproc_path.name}...")
        self.preprocessing_bundle = joblib.load(preproc_path)
        self.preprocessing_service = PreprocessingService(self.preprocessing_bundle)

        # 3. Load Metadata
        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            self.model_name = self.metadata.get("model_name", "LightGBM_Fraud_Classifier")
            self.threshold = float(self.metadata.get("selected_threshold", 0.80))
            self.feature_count = int(self.metadata.get("feature_count", 464))
        else:
            self.threshold = float(self.preprocessing_bundle.get("recommended_threshold", 0.80))
            self.feature_count = len(self.preprocessing_bundle.get("model_features", []))

        self.is_loaded = True
        logger.info(
            f"Model loaded successfully: {self.model_name} "
            f"(features: {self.feature_count}, threshold: {self.threshold:.2f})"
        )

    def predict(self, request: PredictionRequest) -> Dict[str, Any]:
        """
        Execute real-time inference on an incoming transaction payload.
        Returns fraud probability, risk level, decision, and applied threshold.
        """
        if not self.is_loaded or self.model is None or self.preprocessing_service is None:
            raise RuntimeError("ModelService is not loaded. Ensure startup lifecycle completed.")

        # Preprocess request into feature row
        df_input: pd.DataFrame = self.preprocessing_service.transform(request)

        # Predict posterior probability of positive class (isFraud = 1)
        probabilities = self.model.predict_proba(df_input)
        fraud_prob = float(probabilities[0, 1])
        fraud_prob_rounded = round(fraud_prob, 4)

        # Risk classification
        risk_level = RiskService.calculate_risk_level(fraud_prob_rounded)
        is_fraud = RiskService.evaluate_fraud_decision(fraud_prob_rounded, self.threshold)

        return {
            "fraud_probability": fraud_prob_rounded,
            "risk_level": risk_level,
            "is_fraud": is_fraud,
            "threshold": self.threshold,
            "model_name": self.model_name,
            "model_version": self.model_version
        }


# Global singleton instance
model_service = ModelService()
