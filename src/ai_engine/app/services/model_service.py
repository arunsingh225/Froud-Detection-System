import hashlib
import json
import joblib
from pathlib import Path
from typing import Dict, Any, Optional
import lightgbm as lgb
import numpy as np
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


def check_runtime_versions(training_config_path: Path) -> list:
    """
    Compare installed ML library versions with those the model was trained with
    (models/training_config.json). Pickled models can silently mis-predict or crash on a
    mismatch, so every difference is logged loudly and returned.
    """
    from importlib import metadata

    if not training_config_path.exists():
        return []
    expected = json.loads(training_config_path.read_text(encoding="utf-8")).get("packages", {})
    mismatches = []
    for pkg, want in expected.items():
        try:
            have = metadata.version(pkg)
        except metadata.PackageNotFoundError:
            have = "not installed"
        if have != want:
            mismatches.append(f"{pkg}: trained with {want}, installed {have}")
    for m in mismatches:
        logger.error(f"ML version mismatch - {m}. Predictions may be wrong; install requirements.txt.")
    return mismatches


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
        self.version_mismatches: list = []
        self.calibration: Optional[Dict[str, Any]] = None
        self._cal_x: Optional[np.ndarray] = None
        self._cal_y: Optional[np.ndarray] = None

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

        self.version_mismatches = check_runtime_versions(model_path.parent / "training_config.json")

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

        # 2b. Optional probability calibrator (plain JSON, integrity-checked against the manifest)
        self._load_calibration(model_path.parent / "calibration.json", manifest)

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

        if settings.DECISION_THRESHOLD is not None:
            if not 0.0 < settings.DECISION_THRESHOLD < 1.0:
                raise ValueError("DECISION_THRESHOLD must be strictly between 0 and 1")
            logger.warning(f"DECISION_THRESHOLD override active: {settings.DECISION_THRESHOLD} "
                           f"(trained/metadata value was {self.threshold})")
            self.threshold = float(settings.DECISION_THRESHOLD)

        self.is_loaded = True
        logger.info(
            f"Model loaded successfully: {self.model_name} "
            f"(features: {self.feature_count}, threshold: {self.threshold:.2f})"
        )

    def _load_calibration(self, path: Path, manifest: Dict[str, Any]) -> None:
        self.calibration = self._cal_x = self._cal_y = None
        if not path.exists():
            logger.warning("No calibration.json found; calibrated_probability will be null.")
            return
        expected = manifest.get(path.name, {}).get("sha256")
        if not expected or calculate_sha256(path).lower() != expected.lower():
            raise ModelIntegrityError(f"{path.name} is missing from the manifest or its SHA-256 does not match.")
        cal = json.loads(path.read_text(encoding="utf-8"))
        x, y = np.asarray(cal["x_thresholds"], dtype=float), np.asarray(cal["y_thresholds"], dtype=float)
        if len(x) < 2 or len(x) != len(y) or np.any(np.diff(x) < 0) or np.any(np.diff(y) < 0):
            raise ModelIntegrityError("calibration.json is not a valid monotonic mapping.")
        self.calibration, self._cal_x, self._cal_y = cal, x, y
        logger.info(f"Loaded {cal.get('method')} calibrator ({len(x)} knots).")

    def calibrate(self, raw_score: float) -> Optional[float]:
        """Map the raw model score to an empirically calibrated fraud probability (None if unavailable)."""
        if self._cal_x is None:
            return None
        return float(np.interp(raw_score, self._cal_x, self._cal_y))

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
            "raw_score": fraud_prob_rounded,
            "calibrated_probability": None if self._cal_x is None else round(self.calibrate(fraud_prob), 4),
            "risk_level": risk_level,
            "is_fraud": is_fraud,
            "threshold": self.threshold,
            "model_name": self.model_name,
            "model_version": self.model_version
        }


# Global singleton instance
model_service = ModelService()
