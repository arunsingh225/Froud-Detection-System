"""Input-drift monitoring (PSI)."""
import json

import numpy as np
import pytest

from app.config import PROJECT_ROOT
from app.services.drift_service import DriftMonitor, population_stability_index, psi_status

MODELS = PROJECT_ROOT / "models"
REF_PATH = MODELS / "drift_reference.json"
VAL = PROJECT_ROOT / "data" / "processed" / "validation_features.parquet"


def _manifest():
    return json.loads((MODELS / "model_manifest.json").read_text(encoding="utf-8"))


def _monitor(**kw) -> DriftMonitor:
    m = DriftMonitor(**kw)
    m.load(REF_PATH, _manifest())
    return m


def test_psi_is_zero_for_identical_distributions_and_matches_a_worked_example():
    assert population_stability_index([0.25] * 4, [0.25] * 4) == pytest.approx(0.0, abs=1e-12)
    # (0.9-0.5)*ln(0.9/0.5) + (0.1-0.5)*ln(0.1/0.5) = 0.8789
    assert population_stability_index([0.5, 0.5], [0.9, 0.1]) == pytest.approx(0.8789, abs=1e-3)


def test_psi_survives_empty_bins():
    assert np.isfinite(population_stability_index([0.5, 0.5, 0.0], [0.0, 0.5, 0.5]))


@pytest.mark.parametrize("psi,status", [(0.0, "stable"), (0.099, "stable"), (0.1, "moderate"),
                                        (0.25, "moderate"), (0.2501, "significant")])
def test_status_thresholds(psi, status):
    assert psi_status(psi) == status


def test_reference_file_is_consistent_with_the_manifest():
    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    assert len(ref["features"]) == 20
    for name, spec in ref["features"].items():
        assert sum(spec["ref_proportions"]) == pytest.approx(1.0, abs=1e-9), name
        assert len(spec["ref_proportions"]) == len(spec["edges"]) + 2   # bins + one "missing" bin
        assert spec["edges"] == sorted(spec["edges"])
    assert not {"TransactionDT", "TransactionDay", "TransactionWeek"} & set(ref["features"])


def test_tampered_reference_is_rejected(tmp_path):
    bad = tmp_path / "drift_reference.json"
    bad.write_bytes(REF_PATH.read_bytes().replace(b"0.", b"0.0", 1))
    with pytest.raises(ValueError):
        DriftMonitor().load(bad, _manifest())


def test_missing_reference_disables_monitoring_gracefully(tmp_path):
    m = DriftMonitor()
    m.load(tmp_path / "nope.json", {})
    assert m.report()["status"] == "unavailable"


def _frames(shift=None, rows=700):
    pd = pytest.importorskip("pandas")
    pytest.importorskip("pyarrow")
    if not VAL.exists():
        pytest.skip("validation parquet not present")
    df = pd.read_parquet(VAL)
    cur = df.iloc[len(df) // 2:].iloc[:: max(1, (len(df) // 2) // rows)]
    if shift:
        cur = shift(cur.copy())
    return [cur.iloc[[i]] for i in range(len(cur))]


def test_insufficient_data_until_the_minimum_sample_size():
    m = _monitor(min_samples=200)
    for f in _frames(rows=50)[:50]:
        m.observe(f)
    r = m.report()
    assert r["status"] == "insufficient_data" and r["n_samples"] == 50 and r["features"] == []


def test_same_distribution_reports_stable():
    m = _monitor(window=2000, min_samples=200)
    for f in _frames():
        m.observe(f)
    r = m.report()
    assert r["n_samples"] >= 200
    assert r["status"] == "stable", r["features"][:3]
    assert r["max_psi"] < 0.1


def test_a_shifted_feature_is_flagged_and_ranked_first():
    def shift(df):
        df["TransactionAmt"] = df["TransactionAmt"] * 8.0      # e.g. a new high-value merchant segment
        df["C13"] = np.nan                                      # and a telemetry field that stopped arriving
        return df

    m = _monitor(window=2000, min_samples=200)
    for f in _frames(shift=shift):
        m.observe(f)
    r = m.report()
    flagged = {x["feature"]: x for x in r["features"] if x["status"] == "significant"}
    assert r["status"] == "significant"
    assert "TransactionAmt" in flagged and "C13" in flagged
    assert [x["psi"] for x in r["features"]] == sorted((x["psi"] for x in r["features"]), reverse=True)


def test_rolling_window_is_capped():
    m = _monitor(window=100, min_samples=50)
    frames = _frames(rows=300)
    for f in frames:
        m.observe(f)
    assert len(frames) > 100 and m.report()["n_samples"] == 100


def test_observe_never_raises_on_bad_input():
    pd = pytest.importorskip("pandas")
    m = _monitor()
    m.observe(pd.DataFrame())                       # no columns at all
    m.observe(pd.DataFrame({"unrelated": [1.0]}))
    assert m.report()["n_samples"] == 0


def test_drift_endpoint_returns_the_report_shape(client):
    client.post("/predict", json={"TransactionAmt": 25.0})
    body = client.get("/model/drift").json()
    assert body["status"] in {"insufficient_data", "stable", "moderate", "significant"}
    assert {"n_samples", "min_samples", "window", "max_psi", "features"} <= set(body)
    assert body["n_samples"] >= 1


def test_drift_endpoint_requires_the_internal_secret(unauthenticated_client):
    assert unauthenticated_client.get("/model/drift").status_code == 401
