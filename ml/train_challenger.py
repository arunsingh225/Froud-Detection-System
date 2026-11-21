"""
Champion/challenger retrain with a clean 4-way chronological protocol.

    TRAIN (earliest 80% of data)  -> fits the LightGBM trees
    ES    (1st third of the later 20%) -> early stopping ONLY
    CAL   (2nd third)             -> isotonic calibrator + cost-based threshold ONLY
    TEST  (last third)            -> touched once, for reporting (bootstrap 95% CIs)

The champion (models/fraud_model.pkl) is evaluated on the same TEST rows for a fair comparison.
Nothing in models/ is modified; the challenger is written to --out (default models/candidate).
Promote manually (see models/candidate/PROMOTION.md) only if it wins on TEST.

Cost model (assumptions, override with flags):
    missed fraud  = TransactionAmt of that transaction
    every flagged transaction (true or false alert) = --review-cost USD of analyst time

Usage (repo root):
    python ml/train_challenger.py --processed <dir with train_features.parquet + validation_features.parquet>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
SEED = 42
N_BOOT = 300


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def champion():
    manifest = json.loads((ROOT / "models" / "model_manifest.json").read_text(encoding="utf-8"))
    p = ROOT / "models" / "fraud_model.pkl"
    if sha256(p) != manifest["fraud_model.pkl"]["sha256"].lower():
        sys.exit("champion does not match manifest - refusing to load")
    return joblib.load(p)


def ece(y, p, bins=10):
    q = pd.qcut(p, bins, duplicates="drop")
    g = pd.DataFrame({"y": y, "p": p, "q": q}).groupby("q", observed=True).agg(
        y=("y", "mean"), p=("p", "mean"), n=("y", "size"))
    return float((g.n * (g.y - g.p).abs()).sum() / g.n.sum())


def cost(y, amt, flagged, review_cost):
    missed = float(amt[(y == 1) & ~flagged].sum())
    return missed + review_cost * int(flagged.sum())


def best_threshold(y, amt, raw, review_cost):
    cands = np.unique(np.quantile(raw, np.linspace(0.5, 0.9995, 400)))
    costs = [cost(y, amt, raw >= t, review_cost) for t in cands]
    i = int(np.argmin(costs))
    return float(cands[i]), float(costs[i])


def op_point(y, amt, raw, thr, review_cost):
    flagged = raw >= thr
    tp = int((flagged & (y == 1)).sum()); fp = int((flagged & (y == 0)).sum()); fn = int((~flagged & (y == 1)).sum())
    return {"threshold": round(float(thr), 5), "flagged": int(flagged.sum()), "tp": tp, "fp": fp, "fn": fn,
            "precision": round(tp / max(tp + fp, 1), 4), "recall": round(tp / max(tp + fn, 1), 4),
            "total_cost_usd": round(cost(y, amt, flagged, review_cost), 2),
            "cost_if_no_model_usd": round(float(amt[y == 1].sum()), 2)}


def boot(y, amt, raw, thr, review_cost, rng):
    out = {"roc_auc": [], "pr_auc": [], "recall": [], "precision": [], "cost_usd": []}
    n = len(y)
    for _ in range(N_BOOT):
        i = rng.integers(0, n, n)
        yb, ab, rb = y[i], amt[i], raw[i]
        out["roc_auc"].append(roc_auc_score(yb, rb)); out["pr_auc"].append(average_precision_score(yb, rb))
        f = rb >= thr
        tp = (f & (yb == 1)).sum()
        out["recall"].append(tp / max((yb == 1).sum(), 1)); out["precision"].append(tp / max(f.sum(), 1))
        out["cost_usd"].append(cost(yb, ab, f, review_cost))
    return {k: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)] for k, v in out.items()}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", type=Path, default=ROOT / "data" / "processed")
    ap.add_argument("--out", type=Path, default=ROOT / "models" / "candidate")
    ap.add_argument("--review-cost", type=float, default=5.0, help="USD analyst cost per flagged transaction")
    ap.add_argument("--max-trees", type=int, default=3000)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)

    feats = [f.strip() for f in (ROOT / "data" / "processed" / "model_features.txt").read_text(encoding="utf-8").splitlines() if f.strip()]
    train = pd.read_parquet(a.processed / "train_features.parquet")
    val = pd.read_parquet(a.processed / "validation_features.parquet")
    assert train["TransactionDT"].max() <= val["TransactionDT"].min(), "train must precede validation in time"
    assert val["TransactionDT"].is_monotonic_increasing

    # Reproducibility of the regenerated feature set vs the committed one
    committed = ROOT / "data" / "processed" / "validation_features.parquet"
    repro = {}
    if committed.exists() and committed.resolve() != (a.processed / "validation_features.parquet").resolve():
        old = pd.read_parquet(committed)
        repro = {"same_shape": old.shape == val.shape,
                 "features_identical": bool(old.shape == val.shape and np.allclose(
                     old[feats].to_numpy(dtype=float), val[feats].to_numpy(dtype=float), equal_nan=True))}
        print("feature reproducibility vs committed:", repro)

    n = len(val); t1, t2 = n // 3, 2 * n // 3
    es, cal, test = val.iloc[:t1], val.iloc[t1:t2], val.iloc[t2:]
    Xtr, ytr = train[feats], train["isFraud"].to_numpy()
    spw = float((ytr == 0).sum() / (ytr == 1).sum())

    params = dict(objective="binary", metric="auc", boosting_type="gbdt", learning_rate=0.05, num_leaves=63,
                  max_depth=8, min_child_samples=50, subsample=0.8, colsample_bytree=0.8,
                  scale_pos_weight=spw, random_state=SEED, n_jobs=-1, verbose=-1)
    model = lgb.LGBMClassifier(**params, n_estimators=a.max_trees)
    t0 = time.time()
    model.fit(Xtr, ytr, eval_set=[(es[feats], es["isFraud"].to_numpy())], eval_metric="auc",
              callbacks=[lgb.early_stopping(100, verbose=False)])
    print(f"trained in {time.time() - t0:.0f}s, best_iteration={model.best_iteration_} (cap {a.max_trees})")

    champ = champion()
    scores = {}
    for name, m in (("challenger", model), ("champion", champ)):
        scores[name] = {k: m.predict_proba(d[feats])[:, 1] for k, d in (("cal", cal), ("test", test))}
    ycal, ytest = cal["isFraud"].to_numpy(), test["isFraud"].to_numpy()
    acal, atest = cal["TransactionAmt"].to_numpy(), test["TransactionAmt"].to_numpy()

    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(scores["challenger"]["cal"], ycal)
    cal_test = iso.predict(scores["challenger"]["test"])

    rng = np.random.default_rng(SEED)
    thr_new, _ = best_threshold(ycal, acal, scores["challenger"]["cal"], a.review_cost)
    thr_old = 0.80
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "protocol": {"train_rows": len(train), "es_rows": len(es), "cal_rows": len(cal), "test_rows": len(test),
                     "best_iteration": int(model.best_iteration_), "max_trees": a.max_trees,
                     "review_cost_usd": a.review_cost, "feature_reproducibility": repro,
                     "note": "champion saw ES/CAL/TEST rows when its 0.80 threshold and model family were chosen"},
        "test": {
            "fraud_rate": round(float(ytest.mean()), 5),
            "challenger": {
                "roc_auc": round(float(roc_auc_score(ytest, scores["challenger"]["test"])), 4),
                "pr_auc": round(float(average_precision_score(ytest, scores["challenger"]["test"])), 4),
                "op_cost_optimal_on_cal": op_point(ytest, atest, scores["challenger"]["test"], thr_new, a.review_cost),
                "bootstrap_95ci_at_cost_optimal": boot(ytest, atest, scores["challenger"]["test"], thr_new, a.review_cost, rng),
                "calibration": {"brier_raw": round(float(brier_score_loss(ytest, scores["challenger"]["test"])), 5),
                                "brier_calibrated": round(float(brier_score_loss(ytest, cal_test)), 5),
                                "ece_raw": round(ece(ytest, scores["challenger"]["test"]), 5),
                                "ece_calibrated": round(ece(ytest, cal_test), 5)},
            },
            "champion": {
                "roc_auc": round(float(roc_auc_score(ytest, scores["champion"]["test"])), 4),
                "pr_auc": round(float(average_precision_score(ytest, scores["champion"]["test"])), 4),
                "op_at_0.80": op_point(ytest, atest, scores["champion"]["test"], thr_old, a.review_cost),
                "bootstrap_95ci_at_0.80": boot(ytest, atest, scores["champion"]["test"], thr_old, a.review_cost, rng),
            },
        },
    }
    joblib.dump(model, a.out / "fraud_model.pkl")
    (a.out / "calibration.json").write_text(json.dumps({
        "method": "isotonic_regression",
        "fitted_on": "CAL chunk (2nd third of the post-train 20%), never used for tree fitting or early stopping",
        "fit_rows": len(cal), "x_thresholds": [float(x) for x in iso.X_thresholds_],
        "y_thresholds": [float(v) for v in iso.y_thresholds_],
        "apply": "np.interp(raw_score, x_thresholds, y_thresholds)"}, indent=2), encoding="utf-8")
    (a.out / "threshold.json").write_text(json.dumps({"selected_threshold": thr_new,
        "method": f"min expected cost on CAL (missed fraud = amount, flag = ${a.review_cost})"}, indent=2), encoding="utf-8")
    (a.out / "candidate_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["test"], indent=2))


if __name__ == "__main__":
    main()
