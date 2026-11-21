"""Calibration artifact + held-out evaluation checks."""
import json

import numpy as np
import pytest

from app.config import PROJECT_ROOT
from app.services.model_service import ModelIntegrityError, ModelService, model_service

MODELS = PROJECT_ROOT / "models"
pd = pytest.importorskip("pandas")


def test_calibrator_is_monotonic_and_bounded(client):
    xs = np.linspace(0, 1, 201)
    ys = np.array([model_service.calibrate(float(x)) for x in xs])
    assert np.all(np.diff(ys) >= -1e-12) and ys.min() >= 0.0 and ys.max() <= 1.0


def test_predict_returns_raw_and_calibrated(client):
    r = client.post("/predict", json={"TransactionAmt": 45.2, "ProductCD": "W", "card1": 10000,
                                      "TransactionDT": 86400}).json()
    assert r["raw_score"] == r["fraud_probability"]  # decisions and tiers still use the raw score
    assert 0.0 <= r["calibrated_probability"] <= 1.0


def test_tampered_calibration_is_rejected(tmp_path):
    bad = tmp_path / "calibration.json"
    bad.write_text(json.dumps({"x_thresholds": [0, 1], "y_thresholds": [0, 1]}))
    manifest = json.loads((MODELS / "model_manifest.json").read_text())
    with pytest.raises(ModelIntegrityError):
        ModelService()._load_calibration(bad, manifest)


def test_model_info_exposes_holdout_metrics(client):
    info = client.get("/model-info").json()
    assert info["calibration_method"] == "isotonic_regression"
    assert 0.85 < info["holdout_roc_auc"] < 0.95


def test_holdout_report_is_reproducible_and_leak_free(client):
    """Recompute TEST-half metrics; the calibrator must have been fit only on the earlier half."""
    pytest.importorskip("pyarrow")
    from sklearn.metrics import brier_score_loss, roc_auc_score

    rep = json.loads((MODELS / "holdout_evaluation.json").read_text())
    cal = json.loads((MODELS / "calibration.json").read_text())
    df = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "validation_features.parquet")
    feats = [f.strip() for f in (PROJECT_ROOT / "data" / "processed" / "model_features.txt")
             .read_text().splitlines() if f.strip()]

    half = len(df) // 2
    assert cal["fit_rows"] == half == rep["protocol"]["cal_rows"]
    assert df.TransactionDT.iloc[half - 1] <= df.TransactionDT.iloc[half]  # chronological boundary
    assert rep["protocol"]["test_transaction_dt"][0] >= rep["protocol"]["cal_transaction_dt"][1]

    test = df.iloc[half:]
    raw = model_service.model.predict_proba(test[feats])[:, 1]
    y = test["isFraud"].to_numpy()
    assert roc_auc_score(y, raw) == pytest.approx(rep["test_set"]["raw"]["roc_auc"], abs=1e-3)
    cal_p = np.array([model_service.calibrate(float(v)) for v in raw])
    assert brier_score_loss(y, cal_p) == pytest.approx(rep["test_set"]["calibrated"]["brier"], abs=1e-3)
    # calibration must genuinely help on unseen data
    assert rep["test_set"]["calibrated"]["ece"] < rep["test_set"]["raw"]["ece"] / 10
    assert rep["test_set"]["calibrated"]["brier"] < rep["test_set"]["raw"]["brier"]


def test_decision_threshold_override(monkeypatch, client):
    from app.config import settings
    monkeypatch.setattr(settings, "DECISION_THRESHOLD", 0.37)
    svc = ModelService()
    svc.load()
    assert svc.threshold == 0.37
    monkeypatch.setattr(settings, "DECISION_THRESHOLD", 1.5)
    with pytest.raises(ValueError):
        ModelService().load()


def test_cost_analysis_report_shows_threshold_depends_on_review_cost():
    rep = json.loads((MODELS / "cost_threshold_analysis.json").read_text())
    by = {r["review_cost_usd"]: r for r in rep["sweep"]}
    # cheaper reviews justify a lower threshold, and beat the fixed 0.80 on held-out cost
    assert by[5]["cost_optimal_on_cal"]["threshold"] < by[50]["cost_optimal_on_cal"]["threshold"]
    assert by[5]["cost_optimal_on_cal"]["cost_usd"] < by[5]["production_0.80"]["cost_usd"]
