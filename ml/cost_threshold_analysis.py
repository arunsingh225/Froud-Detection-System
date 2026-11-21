"""
Cost-based decision-threshold analysis for the production (champion) model.

Uses only committed artifacts. Chronological thirds of validation_features.parquet:
    CAL  (2nd third) -> choose the threshold that minimises expected cost
    TEST (last third)-> report what that choice would have cost (never used to choose anything)
(The 1st third is skipped; the existing calibrator was fit on the first HALF, so it does not overlap TEST.)

Cost model (assumptions!): a missed fraud costs the transaction amount; every flagged transaction
(true or false alert) costs `review_cost` USD of analyst time. The answer is very sensitive to
review_cost, so a sweep is reported instead of a single number.

Writes models/cost_threshold_analysis.json.   Run from repo root:  python ml/cost_threshold_analysis.py
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
REVIEW_COSTS = [1, 5, 10, 25, 50, 100]
PROD_THRESHOLD = 0.80


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(65536), b""):
            h.update(c)
    return h.hexdigest()


def cost(y, amt, flagged, rc):
    return float(amt[(y == 1) & ~flagged].sum()) + rc * int(flagged.sum())


def point(y, amt, raw, thr, rc):
    f = raw >= thr
    tp = int((f & (y == 1)).sum()); fp = int((f & (y == 0)).sum()); fn = int((~f & (y == 1)).sum())
    return {"threshold": round(float(thr), 4), "alerts": int(f.sum()), "precision": round(tp / max(tp + fp, 1), 3),
            "recall": round(tp / max(tp + fn, 1), 3), "cost_usd": round(cost(y, amt, f, rc), 0)}


def main() -> None:
    manifest = json.loads((ROOT / "models" / "model_manifest.json").read_text(encoding="utf-8"))
    mp = ROOT / "models" / "fraud_model.pkl"
    if sha256(mp) != manifest["fraud_model.pkl"]["sha256"].lower():
        sys.exit("model does not match manifest")
    model = joblib.load(mp)
    feats = [f.strip() for f in (ROOT / "data/processed/model_features.txt").read_text(encoding="utf-8").splitlines() if f.strip()]
    val = pd.read_parquet(ROOT / "data/processed/validation_features.parquet")
    n = len(val); t1, t2 = n // 3, 2 * n // 3
    cal, test = val.iloc[t1:t2], val.iloc[t2:]
    rc_, rt = model.predict_proba(cal[feats])[:, 1], model.predict_proba(test[feats])[:, 1]
    yc, yt = cal["isFraud"].to_numpy(), test["isFraud"].to_numpy()
    ac, at = cal["TransactionAmt"].to_numpy(), test["TransactionAmt"].to_numpy()
    cands = np.unique(np.quantile(rc_, np.linspace(0.5, 0.9995, 400)))

    rows = []
    for rc in REVIEW_COSTS:
        thr = float(cands[int(np.argmin([cost(yc, ac, rc_ >= t, rc) for t in cands]))])
        rows.append({"review_cost_usd": rc,
                     "cost_optimal_on_cal": point(yt, at, rt, thr, rc),
                     "production_0.80": point(yt, at, rt, PROD_THRESHOLD, rc),
                     "no_model": round(float(at[yt == 1].sum()), 0)})
    out = {"test_rows": len(test), "test_fraud_rate": round(float(yt.mean()), 4),
           "mean_fraud_amount_usd": round(float(at[yt == 1].mean()), 2),
           "assumptions": "missed fraud = transaction amount; each alert costs review_cost_usd",
           "sweep": rows}
    (ROOT / "models" / "cost_threshold_analysis.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"TEST rows {len(test)}, fraud {out['test_fraud_rate']:.1%}, mean fraud amount ${out['mean_fraud_amount_usd']}")
    print("review$ | cost-optimal: thr  alerts  prec  recall  cost | prod 0.80: alerts prec recall cost | no-model")
    for r in rows:
        a, b = r["cost_optimal_on_cal"], r["production_0.80"]
        print(f"{r['review_cost_usd']:>6} | {a['threshold']:>6} {a['alerts']:>6} {a['precision']:>5} {a['recall']:>6} {a['cost_usd']:>8.0f} | "
              f"{b['alerts']:>6} {b['precision']:>5} {b['recall']:>6} {b['cost_usd']:>8.0f} | {r['no_model']:.0f}")


if __name__ == "__main__":
    main()
