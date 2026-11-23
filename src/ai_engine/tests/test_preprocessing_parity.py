"""
Train/serve parity for PreprocessingService.

The serving code re-implements the notebook's feature engineering by hand. These tests guard against skew:

* Regression for a real bug: training encoded NaN as an ordinary vocabulary entry (a float-NaN key with its own
  integer code) while serving looked up the string "nan" and fell back to -1 ("unseen"). Every missing
  categorical value (id_*, M*, DeviceInfo, ... which are usually absent in real API calls) was encoded
  differently from training.
* A statistical parity check on real rows: rebuild a request from a training-format row, run it through the
  serving transform, and compare the resulting model scores with scores on the original training vector.

Known residual (not a serving bug): rows whose category never appeared in the training vocabulary carry code -1
in the parquet, and the original string cannot be recovered, so a few percent of rows differ for that reason.
"""
import math

import numpy as np
import pytest

from app.config import PROJECT_ROOT
from app.schemas.prediction import PredictionRequest
from app.services.model_service import model_service

COMPOSITES = {"card1_card2", "card1_card3", "card1_card5", "card4_card6", "addr1_addr2"}


def _nan_codes(svc):
    return {col: code for col, code in svc._na_codes.items() if col not in COMPOSITES}


def test_missing_categoricals_use_the_training_nan_code(client):
    svc = model_service.preprocessing_service
    expected = _nan_codes(svc)
    assert len(expected) >= 20, "vocabularies should contain NaN entries for the sparse categorical columns"

    row = svc.transform(PredictionRequest(TransactionAmt=50.0)).iloc[0]   # everything else missing
    wrong = {c: (int(row[c]), code) for c, code in expected.items() if int(row[c]) != code}
    assert not wrong, f"missing values encoded differently from training (serve, train): {wrong}"


@pytest.mark.parametrize("missing", [None, "nan", "None", float("nan")])
def test_all_missing_spellings_map_to_the_nan_code(client, missing):
    svc = model_service.preprocessing_service
    req = PredictionRequest(TransactionAmt=50.0, DeviceType="mobile").model_copy(update={"card6": missing})
    out = svc.transform(req).iloc[0]
    assert int(out["card6"]) == svc._na_codes["card6"]


def test_unseen_category_still_maps_to_minus_one(client):
    svc = model_service.preprocessing_service
    out = svc.transform(PredictionRequest(TransactionAmt=50.0, card4="definitely-not-a-card-network")).iloc[0]
    assert int(out["card4"]) == -1


def test_known_category_maps_to_its_training_code(client):
    svc = model_service.preprocessing_service
    out = svc.transform(PredictionRequest(TransactionAmt=50.0, card4="visa", ProductCD="W")).iloc[0]
    assert int(out["card4"]) == svc.categorical_vocabularies["card4"]["visa"]
    assert int(out["ProductCD"]) == svc.categorical_vocabularies["ProductCD"]["W"]


def test_scores_on_serving_vectors_match_scores_on_training_vectors(client):
    pd = pytest.importorskip("pandas")
    pytest.importorskip("pyarrow")
    path = PROJECT_ROOT / "data" / "processed" / "validation_features.parquet"
    if not path.exists():
        pytest.skip("validation parquet not present")

    svc = model_service.preprocessing_service
    feats = svc.model_features
    inverse = {col: {code: (None if svc._is_missing(k) else k) for k, code in vocab.items()}
               for col, vocab in svc.categorical_vocabularies.items()}
    sample = pd.read_parquet(path).iloc[::148]            # ~800 rows spread over the whole period

    serve_rows, train_rows = [], []
    for _, r in sample.iterrows():
        if not r["TransactionAmt"] > 0:
            continue
        raw = {}
        for c in feats:
            if c in COMPOSITES:
                continue                                    # serving derives these from card/addr parts
            v = r[c]
            if c in inverse:
                raw[c] = inverse[c].get(int(v))
            else:
                raw[c] = None if pd.isna(v) else (v.item() if hasattr(v, "item") else v)
        for k in ("TransactionDT", "card1"):
            if raw.get(k) is not None:
                raw[k] = int(raw[k])
        serve_rows.append(svc.transform(PredictionRequest(**raw)).iloc[0])
        train_rows.append(r[feats])

    xs = pd.DataFrame(serve_rows)[feats].astype(float)
    xt = pd.DataFrame(train_rows)[feats].astype(float)
    ps = model_service.model.predict_proba(xs)[:, 1]
    pt = model_service.model.predict_proba(xt)[:, 1]

    mean_abs = float(np.abs(ps - pt).mean())
    flipped = float(((ps >= model_service.threshold) != (pt >= model_service.threshold)).mean())
    # before the NaN-code fix: mean 0.0156, 0.75% flipped; after: about 0.002 and 0.2%
    assert mean_abs < 0.006, f"mean |p_serve - p_train| = {mean_abs:.4f}"
    assert flipped < 0.006, f"{flipped:.2%} of decisions differ between serving and training vectors"
    assert not math.isnan(mean_abs)
