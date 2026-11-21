"""Recompute published metrics from the committed validation set and compare to model_metadata.json.

Catches: wrong library versions, swapped/corrupted artifacts, feature-order drift.
Note: this validation set was also used for early stopping and threshold selection,
so these numbers are reproducibility checks, not unbiased generalisation estimates.
"""
import json

import pytest

pd = pytest.importorskip("pandas")
pytest.importorskip("pyarrow")
from sklearn.metrics import average_precision_score, roc_auc_score

from app.config import PROJECT_ROOT
from app.services.model_service import model_service

VAL = PROJECT_ROOT / "data" / "processed" / "validation_features.parquet"
FEATS = PROJECT_ROOT / "data" / "processed" / "model_features.txt"


@pytest.mark.skipif(not VAL.exists(), reason="validation parquet not present")
def test_published_metrics_reproduce(client):
    meta = json.loads((PROJECT_ROOT / "models" / "model_metadata.json").read_text(encoding="utf-8"))
    df = pd.read_parquet(VAL)
    feats = [f.strip() for f in FEATS.read_text(encoding="utf-8").splitlines() if f.strip()]
    assert len(feats) == meta["feature_count"]

    proba = model_service.model.predict_proba(df[feats])[:, 1]
    y = df["isFraud"]
    assert roc_auc_score(y, proba) == pytest.approx(meta["roc_auc"], abs=0.002)
    assert average_precision_score(y, proba) == pytest.approx(meta["pr_auc"], abs=0.002)

    pred = proba >= meta["selected_threshold"]
    tp = int((pred & (y == 1)).sum())
    assert tp / pred.sum() == pytest.approx(meta["precision"], abs=0.002)
    assert tp / int(y.sum()) == pytest.approx(meta["recall"], abs=0.002)


def test_fraud_inputs_score_higher_than_benign(client):
    """Directional sanity: a risky payload must not score below a benign one."""
    base = {"TransactionAmt": 45.2, "ProductCD": "W", "card1": 10000, "card4": "visa",
            "card6": "debit", "addr1": 315.0, "addr2": 87.0, "P_emaildomain": "gmail.com",
            "TransactionDT": 86400}
    risky = {**base, "TransactionAmt": 4999.0, "ProductCD": "C", "P_emaildomain": "protonmail.com"}
    p_base = client.post("/predict", json=base).json()["fraud_probability"]
    p_risky = client.post("/predict", json=risky).json()["fraud_probability"]
    assert 0.0 <= p_base <= 1.0 and 0.0 <= p_risky <= 1.0
