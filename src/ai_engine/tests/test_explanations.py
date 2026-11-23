"""Per-prediction explanations (LightGBM TreeSHAP) must be exact, ordered, and opt-in."""
import math

import numpy as np
from app.config import PROJECT_ROOT
import pytest

from app.schemas.prediction import PredictionRequest
from app.services.model_service import model_service

PAYLOAD = {"TransactionAmt": 4999.0, "ProductCD": "C", "card1": 10000, "card4": "visa", "card6": "credit",
           "addr1": 315.0, "addr2": 87.0, "P_emaildomain": "protonmail.com", "TransactionDT": 86400,
           "DeviceType": "mobile"}


def test_contributions_plus_bias_equal_the_models_raw_margin(client):
    """The defining property of SHAP values: bias + sum(all contributions) == model output (log-odds)."""
    svc = model_service
    df = svc.preprocessing_service.transform(PredictionRequest(**PAYLOAD))
    out = svc.explain(df, top_k=df.shape[1])            # all features, not just the top few

    total = out["base_value"] + sum(f["contribution"] for f in out["top_factors"])
    margin = float(svc.model.predict(df, raw_score=True)[0])
    assert total == pytest.approx(margin, abs=2e-3)      # contributions are rounded to 5 decimals each

    prob = float(svc.model.predict_proba(df)[0, 1])
    assert 1.0 / (1.0 + math.exp(-margin)) == pytest.approx(prob, abs=1e-6)


def test_top_factors_are_sorted_by_absolute_contribution(client):
    df = model_service.preprocessing_service.transform(PredictionRequest(**PAYLOAD))
    factors = model_service.explain(df, top_k=10)["top_factors"]
    mags = [abs(f["contribution"]) for f in factors]
    assert len(factors) == 10 and mags == sorted(mags, reverse=True)
    assert all(f["feature"] in df.columns for f in factors)


def test_explain_is_off_by_default(client):
    body = client.post("/predict", json=PAYLOAD).json()
    assert body["top_factors"] is None and body["base_value"] is None


def test_explain_returns_top_k_factors_and_does_not_change_the_score(client):
    plain = client.post("/predict", json=PAYLOAD).json()
    explained = client.post("/predict?explain=true&top_k=7", json=PAYLOAD).json()
    assert len(explained["top_factors"]) == 7
    assert isinstance(explained["base_value"], float)
    for key in ("fraud_probability", "calibrated_probability", "risk_level", "is_fraud"):
        assert explained[key] == plain[key]
    f = explained["top_factors"][0]
    assert set(f) == {"feature", "value", "contribution"}


def test_default_top_k_is_five(client):
    assert len(client.post("/predict?explain=true", json=PAYLOAD).json()["top_factors"]) == 5


@pytest.mark.parametrize("k", [0, 21, -1])
def test_top_k_bounds_are_validated(client, k):
    assert client.post(f"/predict?explain=true&top_k={k}", json=PAYLOAD).status_code == 422


def test_missing_feature_values_are_reported_as_null(client):
    df = model_service.preprocessing_service.transform(PredictionRequest(TransactionAmt=50.0))
    factors = model_service.explain(df, top_k=df.shape[1])["top_factors"]
    assert any(f["value"] is None for f in factors)          # most features are absent in this payload
    assert all(not np.isnan(f["contribution"]) for f in factors)


def test_scoring_model_is_single_threaded_and_scores_are_unchanged(client):
    import joblib
    pristine = joblib.load(model_service.preprocessing_service and (PROJECT_ROOT / "models" / "fraud_model.pkl"))
    df = model_service.preprocessing_service.transform(PredictionRequest(**PAYLOAD))
    assert model_service.model.get_params()["n_jobs"] == 1
    assert float(model_service.model.predict_proba(df)[0, 1]) == float(pristine.predict_proba(df)[0, 1])
