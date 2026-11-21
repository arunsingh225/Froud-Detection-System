"""
Held-out evaluation + probability calibration for the production LightGBM model.

Protocol (chronological, no shuffling):
    validation_features.parquet is sorted by TransactionDT (the model was trained on the
    EARLIER 80% of the data). It is split in half by time:

        CAL  = earlier half  -> fits the isotonic calibrator (the ONLY thing fitted here)
        TEST = later half    -> never used for any fitting in this script; all headline
                                numbers are reported on it, with bootstrap 95% CIs.

Honest caveats (also written into the output JSON):
    * The model itself was early-stopped on the full validation set, but best_iteration_
      equals the n_estimators cap (299/300), so early stopping never selected a tree count.
    * Model family selection (LR vs RF vs LightGBM) and the 0.80 threshold were chosen on the
      full validation set. TEST is therefore held out for calibration and reporting, not a
      pristine estimate for those two choices. A fully clean protocol needs a 3-way split
      and a retrain (see README).

Outputs (all deterministic, seed 42):
    models/calibration.json         isotonic calibrator as plain JSON (no pickle), SHA-256 added to the manifest
    models/holdout_evaluation.json  metrics on CAL and TEST, calibration quality, bootstrap CIs
    data/processed/calibration_reliability.png   (only if matplotlib is installed)

Run from the repository root:
    python ml/calibrate_and_evaluate.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"
PROCESSED = ROOT / "data" / "processed"
SEED = 42
N_BOOT = 300
THRESHOLD = 0.80  # production operating point (raw score), unchanged by this script


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def verified_model():
    """Load the model only after its SHA-256 matches the manifest (same rule as the service)."""
    manifest = json.loads((MODELS / "model_manifest.json").read_text(encoding="utf-8"))
    path = MODELS / "fraud_model.pkl"
    if sha256(path) != manifest["fraud_model.pkl"]["sha256"].lower():
        sys.exit("fraud_model.pkl does not match model_manifest.json - refusing to load.")
    return joblib.load(path), manifest


def ece(y, p, bins: int = 10) -> float:
    """Expected calibration error with equal-mass (quantile) bins."""
    q = pd.qcut(p, bins, duplicates="drop")
    g = pd.DataFrame({"y": y, "p": p, "q": q}).groupby("q", observed=True).agg(
        y=("y", "mean"), p=("p", "mean"), n=("y", "size"))
    return float((g.n * (g.y - g.p).abs()).sum() / g.n.sum())


def reliability_table(y, p, bins: int = 10):
    q = pd.qcut(p, bins, duplicates="drop")
    g = pd.DataFrame({"y": y, "p": p, "q": q}).groupby("q", observed=True).agg(
        observed_rate=("y", "mean"), mean_predicted=("p", "mean"), n=("y", "size"))
    return [{"bin": i + 1, "n": int(r.n), "mean_predicted": round(float(r.mean_predicted), 5),
             "observed_rate": round(float(r.observed_rate), 5)} for i, r in enumerate(g.itertuples())]


def confusion(y, p, thr):
    pred = p >= thr
    tp = int((pred & (y == 1)).sum()); fp = int((pred & (y == 0)).sum())
    fn = int((~pred & (y == 1)).sum()); tn = int((~pred & (y == 0)).sum())
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "precision": round(tp / max(tp + fp, 1), 4), "recall": round(tp / max(tp + fn, 1), 4)}


def metrics(y, p):
    return {"rows": int(len(y)), "fraud_rate": round(float(y.mean()), 5),
            "roc_auc": round(float(roc_auc_score(y, p)), 4),
            "pr_auc": round(float(average_precision_score(y, p)), 4),
            "brier": round(float(brier_score_loss(y, np.clip(p, 0, 1))), 5),
            "ece": round(ece(y, p), 5)}


def bootstrap_ci(y, p, thr, rng):
    out = {"roc_auc": [], "pr_auc": [], "precision": [], "recall": []}
    n = len(y)
    for _ in range(N_BOOT):
        i = rng.integers(0, n, n)
        yb, pb = y[i], p[i]
        out["roc_auc"].append(roc_auc_score(yb, pb))
        out["pr_auc"].append(average_precision_score(yb, pb))
        c = confusion(yb, pb, thr)
        out["precision"].append(c["precision"]); out["recall"].append(c["recall"])
    return {k: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)]
            for k, v in out.items()}


def main() -> None:
    model, manifest = verified_model()
    feats = [f.strip() for f in (PROCESSED / "model_features.txt").read_text(encoding="utf-8").splitlines() if f.strip()]
    df = pd.read_parquet(PROCESSED / "validation_features.parquet")
    assert df["TransactionDT"].is_monotonic_increasing, "validation set must be sorted by time"

    raw = model.predict_proba(df[feats])[:, 1]
    y = df["isFraud"].to_numpy()
    half = len(df) // 2
    cal, test = slice(0, half), slice(half, None)

    # Fit calibrator on CAL only.
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(raw[cal], y[cal])
    calibrated = iso.predict(raw)

    rng = np.random.default_rng(SEED)
    thr_cal = float(iso.predict([THRESHOLD])[0])
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "protocol": {
            "split": "chronological halves of validation_features.parquet",
            "cal_rows": int(half), "test_rows": int(len(df) - half),
            "cal_transaction_dt": [int(df.TransactionDT.iloc[0]), int(df.TransactionDT.iloc[half - 1])],
            "test_transaction_dt": [int(df.TransactionDT.iloc[half]), int(df.TransactionDT.iloc[-1])],
            "fitted_on_cal_only": ["isotonic calibrator"],
            "model_best_iteration": int(model.best_iteration_ or 0),
            "model_n_estimators": int(model.get_params()["n_estimators"]),
            "caveats": [
                "Model family selection and the 0.80 threshold were chosen on the full validation set (incl. TEST).",
                "TEST is held out for calibration and reporting; it is not a pristine estimate for threshold choice.",
                "Isotonic calibration is monotonic, so ranking metrics (ROC-AUC) are essentially unchanged.",
            ],
        },
        "operating_point": {"raw_threshold": THRESHOLD, "equivalent_calibrated_probability": round(thr_cal, 4)},
        "cal_set": {"raw": metrics(y[cal], raw[cal]), "confusion_at_0.80": confusion(y[cal], raw[cal], THRESHOLD)},
        "test_set": {
            "raw": metrics(y[test], raw[test]),
            "calibrated": metrics(y[test], calibrated[test]),
            "log_loss_raw": round(float(log_loss(y[test], np.clip(raw[test], 1e-6, 1 - 1e-6))), 5),
            "log_loss_calibrated": round(float(log_loss(y[test], np.clip(calibrated[test], 1e-6, 1 - 1e-6))), 5),
            "confusion_at_0.80": confusion(y[test], raw[test], THRESHOLD),
            "bootstrap_95ci_raw": bootstrap_ci(y[test], raw[test], THRESHOLD, rng),
            "reliability_raw": reliability_table(y[test], raw[test]),
            "reliability_calibrated": reliability_table(y[test], calibrated[test]),
        },
    }

    cal_json = {
        "method": "isotonic_regression",
        "fitted_on": "chronologically earlier half of validation_features.parquet",
        "fit_rows": int(half),
        "x_thresholds": [float(x) for x in iso.X_thresholds_],
        "y_thresholds": [float(v) for v in iso.y_thresholds_],
        "apply": "np.interp(raw_score, x_thresholds, y_thresholds)  (clipped at the ends)",
    }
    (MODELS / "calibration.json").write_text(json.dumps(cal_json, indent=2), encoding="utf-8")
    (MODELS / "holdout_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    manifest["calibration.json"] = {"path": "models/calibration.json",
                                    "sha256": sha256(MODELS / "calibration.json"),
                                    "size_bytes": (MODELS / "calibration.json").stat().st_size}
    (MODELS / "model_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(5.5, 5))
        for name, p in (("raw score", raw[test]), ("calibrated", calibrated[test])):
            t = reliability_table(y[test], p)
            ax.plot([r["mean_predicted"] for r in t], [r["observed_rate"] for r in t], "o-", label=name)
        ax.plot([0, 1], [0, 1], "k--", label="perfect")
        ax.set_xlabel("mean predicted probability"); ax.set_ylabel("observed fraud rate")
        ax.set_title("Reliability on held-out TEST half"); ax.legend(); fig.tight_layout()
        fig.savefig(PROCESSED / "calibration_reliability.png", dpi=130)
    except ImportError:
        print("matplotlib not installed - skipped reliability plot")

    t = report["test_set"]
    print(f"TEST raw        : {t['raw']}")
    print(f"TEST calibrated : {t['calibrated']}")
    print(f"TEST @0.80      : {t['confusion_at_0.80']}")
    print(f"TEST 95% CI     : {t['bootstrap_95ci_raw']}")
    print(f"0.80 raw == {thr_cal:.4f} calibrated")


if __name__ == "__main__":
    main()
