#!/usr/bin/env python3
"""Compute reference numbers for the parity tests (dev only: numpy, scipy, pyarrow).

Each block re-implements a formula from PhosKinTime's own plotting code at commit
e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b (branch sci/2026-12), cited inline, and applies it to
the spec fixtures. The TypeScript transforms are compared against these numbers in
tests/parity/parity.test.ts at rtol 1e-9.

This script does not import PhosKinTime. Where PhosKinTime calls a library (scipy.stats.linregress,
scipy.stats.entropy, numpy.quantile), the same library call is used here.

Usage: python tests/reference/compute_reference.py  (writes tests/reference/out/reference.json)
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
from scipy.stats import entropy, linregress

HERE = Path(__file__).resolve().parent
FIX = HERE.parent / "fixtures" / "out"
OUT = HERE / "out" / "reference.json"


def table(bundle: str, name: str):
    return pq.read_table(FIX / f"{bundle}.pkt" / "tables" / f"{name}.parquet").to_pandas()


def f(x):
    """JSON-safe float."""
    x = float(x)
    if math.isnan(x):
        return None
    if math.isinf(x):
        return "inf" if x > 0 else "-inf"
    return x


# networkmodel/export.py:311-331 `_robust_sigma`
def robust_sigma(residuals):
    r = np.asarray(residuals, dtype=float)
    r = r[np.isfinite(r)]
    if r.size < 10:
        s = float(np.std(r))
        return s if s > 0 else 1e-12
    med = np.median(r)
    mad = np.median(np.abs(r - med))
    s = 1.4826 * mad
    if s <= 0:
        s = float(np.std(r))
    return s if s > 0 else 1e-12


def network_gof(df):
    # export.py:395 resid = pred - obs; :398-399 z; :414-416 linregress r², identity RMSE
    df = df.dropna(subset=["value_obs", "value_pred"])
    x = df["value_obs"].to_numpy(float)
    y = df["value_pred"].to_numpy(float)
    resid = y - x
    s = robust_sigma(resid)
    lr = linregress(x, y)
    return {
        "n": int(x.size),
        "sigma": f(s),
        "d95": f(1.959963984540054 * s),
        "d99": f(2.5758293035489004 * s),
        "r2": f(lr.rvalue ** 2),
        "rmse": f(np.sqrt(np.mean((y - x) ** 2))),
        "slope": f(lr.slope),
        "intercept": f(lr.intercept),
    }


# networkmodel/BayesianInference.py:1208 `_smooth_density_1d` (verbatim logic)
def smooth_density_1d(values, grid_size=256):
    values = np.asarray(values, dtype=np.float64)
    values = values[np.isfinite(values)]
    if values.size == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 0.0])
    if values.size == 1 or np.allclose(values, values[0]):
        center = float(values[0])
        span = max(abs(center) * 0.05, 1e-3)
        x_grid = np.linspace(center - span, center + span, grid_size)
        density = np.exp(-0.5 * ((x_grid - center) / (span / 4.0)) ** 2)
        density = density / max(float(density.max()), 1e-12)
        return x_grid, density
    vmin = float(np.min(values))
    vmax = float(np.max(values))
    span = vmax - vmin
    pad = 0.1 * span
    x_grid = np.linspace(vmin - pad, vmax + pad, grid_size)
    sd = float(np.std(values, ddof=1))
    n = values.size
    bandwidth = 1.06 * sd * (n ** (-1.0 / 5.0))
    bandwidth = max(bandwidth, span / 200.0, 1e-8)
    z = (x_grid[:, None] - values[None, :]) / bandwidth
    density = np.exp(-0.5 * z * z).mean(axis=1)
    density = density / (bandwidth * np.sqrt(2.0 * np.pi))
    max_density = float(np.max(density))
    if max_density > 0:
        density = density / max_density
    return x_grid, density


def box(values):
    # Tukey box as SveltePlot BoxY draws it; quartiles = numpy.quantile default (linear)
    v = np.sort(np.asarray(values, float)[np.isfinite(values)])
    q1, med, q3 = np.quantile(v, [0.25, 0.5, 0.75])
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    inside = v[(v >= lo) & (v <= hi)]
    return {"n": int(v.size), "q1": f(q1), "median": f(med), "q3": f(q3), "whiskerLow": f(inside[0]), "whiskerHigh": f(inside[-1]),
            "outliers": [f(x) for x in v[(v < lo) | (v > hi)]]}


def main():
    ref: dict = {"source_commit": "e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b"}

    # --- networkmodel GOF, overall and per layer, best-fit sample (network fixture)
    tr = table("network", "trajectories")
    best = tr[tr["sample_id"] == "best"]
    ref["gof_network"] = {"overall": network_gof(best)}
    for layer in ["rna", "protein", "phospho"]:
        ref["gof_network"][layer] = network_gof(best[best["layer"] == layer])

    # --- protwise GOF offsets (plotting.py:319-321): std (ddof 0) of pooled observations
    sp = table("small-protwise", "trajectories")
    pw = sp[sp["layer"].isin(["protein", "phospho"])]
    obs = pw["value_obs"].to_numpy(float)
    s = np.std(obs[np.isfinite(obs)])
    ref["gof_protwise"] = {"std": f(s), "d95": f(1.96 * s), "d99": f(2.576 * s)}

    # --- KL per gene (plotting.py:379-396): row-normalise, scipy entropy (nats), mean per gene.
    # Rows with gaps: pairwise-complete time points (documented in docs/substitutions.md).
    rows = []
    for (gene, state), g in pw.groupby(["protein", "state"], sort=True):
        g = g.sort_values("time")
        o = g["value_obs"].to_numpy(float)
        e = g["value_pred"].to_numpy(float)
        m = np.isfinite(o) & np.isfinite(e)
        o, e = o[m], e[m]
        kl = entropy(o / o.sum(), e / e.sum())
        rows.append({"gene": gene, "state": state, "kl": f(kl), "points": int(m.sum())})
    by = {}
    for r in rows:
        by.setdefault(r["gene"], []).append(r["kl"])
    ref["kl"] = {"rows": rows, "by_gene": {k: f(np.mean(v)) for k, v in by.items()}, "threshold": 0.03}

    # --- envelopes per exact time across the 20 samples for the first 5 states
    states = sorted(tr["state"].unique())[:5]
    env = []
    for st in states:
        for t, g in tr[tr["state"] == st].groupby("time", sort=True):
            v = g["value_pred"].to_numpy(float)
            q = np.quantile(v, [0.01, 0.05, 0.5, 0.95, 0.99])
            env.append({"key": st, "time": f(t), "n": int(v.size), "min": f(v.min()), "max": f(v.max()),
                        "q01": f(q[0]), "q05": f(q[1]), "q50": f(q[2]), "q95": f(q[3]), "q99": f(q[4])})
    ref["envelopes"] = {"states": states, "rows": env}

    # --- posterior: KDE (ridgeline) and 5/50/95 % quantiles (BayesianInference.py:870-874, :1335)
    post = np.load(FIX / "network.pkt" / "arrays" / "posterior_draws.npy")
    flat = post.reshape(-1, post.shape[2])
    kde = []
    for j in range(5):
        x, d = smooth_density_1d(flat[:, j])
        kde.append({"param_index": j, "x": [f(v) for v in x], "density": [f(v) for v in d]})
    ref["kde"] = kde
    ref["credible"] = [{"param_index": j, "q05": f(np.quantile(flat[:, j], 0.05)), "q50": f(np.quantile(flat[:, j], 0.5)),
                        "q95": f(np.quantile(flat[:, j], 0.95)), "mean": f(flat[:, j].mean()), "sd": f(flat[:, j].std(ddof=0))}
                       for j in range(10)]

    # --- box statistics: multistart objectives and residuals per layer
    ms = table("network", "multistart")
    ref["box"] = {"multistart": box(ms["objective"].to_numpy(float))}
    for layer in ["rna", "protein", "phospho"]:
        b = best[best["layer"] == layer].dropna(subset=["value_obs", "value_pred"])
        ref["box"][f"resid_{layer}"] = box((b["value_pred"] - b["value_obs"]).to_numpy(float))

    # --- OLS (regression layer) vs linregress: obs vs pred per layer
    ref["ols"] = {}
    for layer in ["rna", "protein", "phospho"]:
        b = best[best["layer"] == layer].dropna(subset=["value_obs", "value_pred"])
        lr = linregress(b["value_obs"].to_numpy(float), b["value_pred"].to_numpy(float))
        ref["ols"][layer] = {"slope": f(lr.slope), "intercept": f(lr.intercept), "r": f(lr.rvalue)}

    # --- finite-difference arrows on the PCA path of PROT1
    emb = table("small-protwise", "embeddings")
    e = emb[(emb["protein"] == "PROT1") & (emb["method"] == "pca")].sort_values("time")
    t, x, y = e["time"].to_numpy(float), e["x"].to_numpy(float), e["y"].to_numpy(float)
    ref["arrows"] = [{"t0": f(t[i]), "t1": f(t[i + 1]), "dx": f(x[i + 1] - x[i]), "dy": f(y[i + 1] - y[i]),
                      "angleDeg": f(np.degrees(np.arctan2(x[i + 1] - x[i], y[i + 1] - y[i])))} for i in range(len(t) - 1)]

    # --- comparison deltas: network (A) vs network-after-fix (B)
    pa_ = table("network", "parameters").set_index("name")["value"]
    pb_ = table("network-after-fix", "parameters").set_index("name")["value"]
    common = [n for n in pa_.index if n in pb_.index]
    ref["compare_params"] = {n: {"delta": f(pb_[n] - pa_[n]), "ratio": f(pb_[n] / pa_[n]) if pa_[n] != 0 else None,
                                 "log2ratio": f(np.log2(pb_[n] / pa_[n])) if pa_[n] > 0 and pb_[n] > 0 else None} for n in common}
    trb = table("network-after-fix", "trajectories")
    a = best.set_index(["state", "time"])["value_pred"]
    b = trb[trb["sample_id"] == "best"].set_index(["state", "time"])["value_pred"]
    d = (b - a).dropna()
    ref["compare_traj"] = {"n": int(d.size), "max_abs": f(np.abs(d).max()), "mean": f(d.mean()), "sum": f(d.sum()),
                           "first": {"state": d.index[0][0], "time": f(d.index[0][1]), "delta": f(d.iloc[0])}}
    gb = trb[trb["sample_id"] == "best"]
    ref["compare_gof"] = {layer: {"a": network_gof(best[best["layer"] == layer]), "b": network_gof(gb[gb["layer"] == layer])}
                          for layer in ["rna", "protein", "phospho"]}
    # reordered-params vs network: by-name alignment
    pr = table("reordered-params", "parameters").set_index("name")["value"]
    ref["compare_reordered"] = {"only_a": sorted(n for n in pa_.index if n not in pr.index),
                                "only_b": sorted(n for n in pr.index if n not in pa_.index),
                                "n_pairs": int(sum(1 for n in pa_.index if n in pr.index))}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ref))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
