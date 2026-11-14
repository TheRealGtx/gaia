"""EchoField node model (Chuqi).

Each node learns its own "normal" temperature (running mean + std,
Welford's algorithm) and scores how abnormal the current reading is.
Neighbours share only mu / sigma / n (federated learning).

Interface for Giuliano's node loop:
    anomaly_score(values) -> float 0..1
    get_params()          -> {"mu", "sigma", "n"}
    merge_params(list)    -> None
"""
import json
import math
import time
from collections import deque

# ---- tuning knobs (calibrate with calibrate.py on real CSVs) ----------
SIGMA_FLOOR = 0.5     # °C. Below this, sensor noise would cause false alarms
ZMAX = 4.0            # z-score that maps to score 1.0
RATE_WINDOW = 10      # seconds used for the rate-of-change feature
RATE_MAX = 1.5        # °C rise within RATE_WINDOW that maps to score 1.0
LEARN_BELOW = 0.4     # only learn from readings that look normal
N_MAX = 300           # cap on sample count, so the model keeps learning after merges
WARMUP = 20           # readings before the node trusts its own level score


class NodeModel:
    def __init__(self):
        self.n, self.mu, self.var = 0, 0.0, 0.0
        self.recent = deque()           # (time, temp) for rate of change
        self.bytes_sent = 0             # bytes of params actually shared
        self.bytes_if_raw_data = 0      # bytes if we had shared raw readings

    # ---- statistics ---------------------------------------------------
    @property
    def sigma(self):
        return math.sqrt(self.var) if self.n > 1 else 1.0

    def _learn(self, x):
        """Running mean and variance. Each new reading gets weight 1/n.
        n stops at N_MAX, so the model keeps learning and slowly forgets old data."""
        self.n = min(self.n + 1, N_MAX)
        a = 1.0 / self.n
        d = x - self.mu
        self.mu += a * d
        self.var = (1 - a) * (self.var + a * d * d)

    # ---- scoring ------------------------------------------------------
    def level_score(self, x):
        if self.n < WARMUP:
            return 0.0                  # not enough data to judge the level yet
        z = abs(x - self.mu) / max(self.sigma, SIGMA_FLOOR)
        return min(1.0, z / ZMAX)

    def rate_score(self, t, x):
        self.recent.append((t, x))
        while self.recent and t - self.recent[0][0] > RATE_WINDOW:
            self.recent.popleft()
        rise = x - self.recent[0][1]    # only rises count: fire heats, it does not cool
        return max(0.0, min(1.0, rise / RATE_MAX))

    def score(self, values, t=None):
        t = time.time() if t is None else t
        x = values["temp"]
        s = max(self.level_score(x), self.rate_score(t, x))
        if s < LEARN_BELOW:
            self._learn(x)              # never learn the hazard as the new normal
        self.bytes_if_raw_data += len(json.dumps(values))
        return s

    # ---- federated learning ------------------------------------------
    def get_params(self):
        p = {"mu": round(self.mu, 3), "sigma": round(self.sigma, 3), "n": self.n}
        self.bytes_sent += len(json.dumps(p))
        return p

    def merge_params(self, others):
        """Pooled mean/variance of me + neighbours, weighted by n, n capped."""
        allp = [{"mu": self.mu, "sigma": self.sigma, "n": self.n}]
        allp += [p for p in others if p.get("n", 0) > 0]
        total = sum(p["n"] for p in allp)
        if total == 0:
            return
        mu = sum(p["mu"] * p["n"] for p in allp) / total
        var = sum(p["n"] * (p["sigma"] ** 2 + (p["mu"] - mu) ** 2) for p in allp) / total
        self.n = min(total, N_MAX)
        self.mu, self.var = mu, var


# ---- module-level functions: what Giuliano imports --------------------
_model = NodeModel()


def anomaly_score(values, t=None):
    return _model.score(values, t)


def get_params():
    return _model.get_params()


def merge_params(neighbour_params):
    _model.merge_params(neighbour_params)


def bytes_report():
    return {"bytes_sent": _model.bytes_sent, "bytes_if_raw_data": _model.bytes_if_raw_data}
