"""
Runtime input-drift monitor using the Population Stability Index (PSI).

A rolling window of the most important model features seen by /predict is compared against the reference
distribution in models/drift_reference.json (built by ml/build_drift_reference.py; integrity-checked against the
manifest like the other artifacts).

    PSI = sum_i (cur_i - ref_i) * ln(cur_i / ref_i)   over the reference bins, with a separate bin for "missing"

Common reading: < 0.1 stable, 0.1 to 0.25 moderate shift, > 0.25 significant shift.
Caveat: this monitors the data the engine is actually sent. Traffic produced by the API's approximate
transaction-to-IEEE mapping (constants for many features) will legitimately show drift against IEEE-CIS data.
"""
import hashlib
import json
import threading
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.logging_config import logger

EPSILON = 1e-4          # floor for bin proportions so empty bins do not make the logarithm blow up
MODERATE, SIGNIFICANT = 0.10, 0.25


def psi_status(psi: float) -> str:
    return "significant" if psi > SIGNIFICANT else "moderate" if psi >= MODERATE else "stable"


def population_stability_index(ref: np.ndarray, cur: np.ndarray) -> float:
    ref = np.clip(np.asarray(ref, dtype=float), EPSILON, None)
    cur = np.clip(np.asarray(cur, dtype=float), EPSILON, None)
    ref, cur = ref / ref.sum(), cur / cur.sum()
    return float(np.sum((cur - ref) * np.log(cur / ref)))


class DriftMonitor:
    def __init__(self, window: int = 2000, min_samples: int = 200):
        self.window = window
        self.min_samples = min_samples
        self._lock = threading.Lock()
        self._buffer: deque = deque(maxlen=window)
        self._features: List[str] = []
        self._edges: Dict[str, np.ndarray] = {}
        self._ref: Dict[str, np.ndarray] = {}

    @property
    def available(self) -> bool:
        return bool(self._features)

    def load(self, path: Path, manifest: Dict[str, Any]) -> None:
        """Load the reference; a missing file disables monitoring, a tampered one is an integrity error."""
        self._features, self._edges, self._ref = [], {}, {}
        if not path.exists():
            logger.warning("No drift_reference.json found; drift monitoring is disabled.")
            return
        expected = manifest.get(path.name, {}).get("sha256")
        h = hashlib.sha256(path.read_bytes()).hexdigest()
        if not expected or h.lower() != expected.lower():
            raise ValueError(f"{path.name} is missing from the manifest or its SHA-256 does not match.")
        data = json.loads(path.read_text(encoding="utf-8"))
        for name, spec in data["features"].items():
            self._features.append(name)
            self._edges[name] = np.asarray(spec["edges"], dtype=float)
            self._ref[name] = np.asarray(spec["ref_proportions"], dtype=float)
        with self._lock:
            self._buffer.clear()
        logger.info(f"Drift monitor ready: {len(self._features)} features, window {self.window}.")

    def observe(self, df: pd.DataFrame) -> None:
        """Record the monitored features of the (single-row) frame that was just scored. Never raises."""
        if not self.available:
            return
        try:
            row = df.iloc[0][self._features].to_numpy(dtype=float)
        except Exception as exc:  # monitoring must never break scoring
            logger.warning(f"Drift observe skipped: {exc}")
            return
        with self._lock:
            self._buffer.append(row)

    def _bin_proportions(self, name: str, values: np.ndarray) -> np.ndarray:
        edges = self._edges[name]
        missing = np.isnan(values)
        counts = np.bincount(np.digitize(values[~missing], edges), minlength=len(edges) + 1).astype(float)
        counts = np.append(counts, float(missing.sum()))
        return counts / max(counts.sum(), 1.0)

    def report(self) -> Dict[str, Any]:
        if not self.available:
            return {"status": "unavailable", "n_samples": 0, "min_samples": self.min_samples,
                    "window": self.window, "max_psi": None, "features": []}
        with self._lock:
            snapshot = np.array(self._buffer, dtype=float) if self._buffer else np.empty((0, len(self._features)))
        n = int(snapshot.shape[0])
        if n < self.min_samples:
            return {"status": "insufficient_data", "n_samples": n, "min_samples": self.min_samples,
                    "window": self.window, "max_psi": None, "features": []}
        rows = []
        for j, name in enumerate(self._features):
            psi = population_stability_index(self._ref[name], self._bin_proportions(name, snapshot[:, j]))
            rows.append({"feature": name, "psi": round(psi, 4), "status": psi_status(psi)})
        rows.sort(key=lambda r: -r["psi"])
        worst = rows[0]["psi"]
        return {"status": psi_status(worst), "n_samples": n, "min_samples": self.min_samples,
                "window": self.window, "max_psi": worst, "features": rows}
