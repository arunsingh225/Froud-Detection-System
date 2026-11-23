"""
Build the reference distribution used by the runtime drift monitor (Population Stability Index).

For the most important model features (by LightGBM gain) it stores decile bin edges and the reference share of
rows per bin, plus a dedicated bin for missing values. The engine compares a rolling window of live scoring
requests against it (app/services/drift_service.py, GET /model/drift).

Reference data: the chronologically EARLIER half of validation_features.parquet (the training split itself is not
committed). Time counters (TransactionDT/Day/Week) are excluded because they drift by construction.

Writes models/drift_reference.json (LF bytes) and adds its SHA-256 to models/model_manifest.json.
Run from the repo root:  python ml/build_drift_reference.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"
N_FEATURES = 20
N_BINS = 10
EXCLUDE = {"TransactionID", "TransactionDT", "TransactionDay", "TransactionWeek"}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    manifest = json.loads((MODELS / "model_manifest.json").read_text(encoding="utf-8"))
    model_path = MODELS / "fraud_model.pkl"
    if sha256(model_path) != manifest["fraud_model.pkl"]["sha256"].lower():
        sys.exit("fraud_model.pkl does not match the manifest - refusing to load")
    model = joblib.load(model_path)

    feats = [f.strip() for f in (ROOT / "data/processed/model_features.txt").read_text(encoding="utf-8").splitlines() if f.strip()]
    gain = model.booster_.feature_importance(importance_type="gain")
    ranked = [f for _, f in sorted(zip(gain, model.booster_.feature_name()), reverse=True) if f not in EXCLUDE]
    chosen = [f for f in ranked if f in feats][:N_FEATURES]

    df = pd.read_parquet(ROOT / "data/processed/validation_features.parquet")
    ref = df.iloc[: len(df) // 2]

    features = {}
    for f in chosen:
        x = ref[f].to_numpy(dtype=float)
        missing = np.isnan(x)
        vals = x[~missing]
        # inner edges at the deciles; duplicates collapse (discrete / heavily tied features get fewer bins)
        edges = np.unique(np.quantile(vals, np.linspace(0, 1, N_BINS + 1)[1:-1])) if len(vals) else np.array([])
        counts = np.bincount(np.digitize(vals, edges), minlength=len(edges) + 1).astype(float)
        counts = np.append(counts, missing.sum())                 # last bin = missing
        features[f] = {"edges": [float(e) for e in edges], "ref_proportions": [float(c / counts.sum()) for c in counts]}

    out = {
        "description": "Reference bin proportions for PSI drift monitoring; last bin of each feature is 'missing'.",
        "reference": "earlier half of validation_features.parquet",
        "reference_rows": int(len(ref)),
        "n_bins": N_BINS,
        "features": features,
    }
    path = MODELS / "drift_reference.json"
    path.write_bytes(json.dumps(out, indent=2).encode("utf-8"))
    manifest["drift_reference.json"] = {"path": "models/drift_reference.json", "sha256": sha256(path), "size_bytes": path.stat().st_size}
    (MODELS / "model_manifest.json").write_bytes(json.dumps(manifest, indent=2).encode("utf-8"))

    # sanity: PSI of the later half against this reference (the app's tests assert it stays modest)
    cur = df.iloc[len(df) // 2:]
    print(f"{len(chosen)} features, reference rows {len(ref)}")
    for f in chosen:
        e = np.array(features[f]["edges"]); r = np.array(features[f]["ref_proportions"])
        x = cur[f].to_numpy(dtype=float); m = np.isnan(x)
        c = np.append(np.bincount(np.digitize(x[~m], e), minlength=len(e) + 1), m.sum()).astype(float)
        c = np.clip(c / c.sum(), 1e-4, None); rr = np.clip(r, 1e-4, None)
        print(f"  {f:28s} bins={len(r):2d}  PSI(later half vs reference) = {float(np.sum((c - rr) * np.log(c / rr))):.4f}")


if __name__ == "__main__":
    main()
