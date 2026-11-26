#!/usr/bin/env python3
"""Build SPEC FIXTURES: synthetic PhosKinTime run bundles that follow the DRAFT 1.0 schema
in contracts/phoskintime/1.0-draft/.

PhosKinTime has no `phoskintime bundle` command yet, so these bundles are produced from the
viewer's own draft specification, not by PhosKinTime. Every value is synthetic (seeded numpy
random numbers and closed-form curves); nothing here is real data or a real model fit.

Usage: python3 tests/fixtures/make_fixtures.py [--out tests/fixtures/out] [--only NAME ...]
Requires numpy and pyarrow (dev only).
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

SCHEMA = "1.0"
TIMES = np.array([0.0, 0.5, 0.75, 1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 60.0, 120.0, 240.0, 480.0, 960.0])
FIXED_CREATED = "2026-11-26T12:00:00Z"
SPEC_WARNING = {
    "code": "SPEC_FIXTURE",
    "message": "Spec fixture: synthetic bundle written by phoskintime-vis from the DRAFT 1.0 schema, not by PhosKinTime.",
}
ISSUES = {
    "N1": ("H", "JAX RHS has no MODEL 1 (sequential) branch"),
    "N5": ("H", "Configured ODE tolerances are not used"),
    "N6": ("H", "Posterior likelihood lacks N·log σ and shares one σ across modalities"),
    "N7": ("H", "Fold-change baseline: data not 1 at the baseline time"),
    "N8": ("H", "E_i / Dp_i meaning and labels disagree"),
    "N9": ("M", "Combinatorial decay counted once per phosphorylated bit"),
    "N10": ("M", "Legacy numba RHS (steady-state, SBML export) differs from JAX RHS"),
    "N17": ("M", "Exported kinase activity is interpolated linearly; RHS uses a step"),
    "P1": ("M→H", "RNA predictions read from the protein time grid"),
    "P3": ("H", "normalize_model_output divides by initial conditions; objective does not"),
}

TYPE_MAP = {"float64": pa.float64(), "int64": pa.int64(), "string": pa.string(), "bool": pa.bool_()}


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def order_sha(names: list[str]) -> str:
    return sha256_bytes("\n".join(names).encode())


TABLE_DEFS = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts/phoskintime/1.0-draft/tables.json").read_text()
)["tables"]


class Bundle:
    def __init__(self, name: str):
        self.name = name
        self.files: dict[str, bytes] = {}
        self.entries: list[dict] = []
        self.manifest: dict = {}

    def add_table(self, table: str, cols: dict[str, list], units: dict[str, str] | None = None,
                  passthrough: dict | None = None, path: str | None = None):
        tdef = TABLE_DEFS.get(table)
        fields, colmeta = [], []
        names = list(cols.keys())
        for n in names:
            dtype = None
            nullable = True
            if tdef:
                for cd in tdef["columns"]:
                    if cd["name"] == n:
                        dtype, nullable = cd["dtype"], cd["nullable"]
            if dtype is None:
                v = next((x for x in cols[n] if x is not None), "")
                dtype = ("bool" if isinstance(v, (bool, np.bool_)) else "int64" if isinstance(v, (int, np.integer))
                         else "float64" if isinstance(v, (float, np.floating)) else "string")
            fields.append(pa.field(n, TYPE_MAP[dtype], nullable=True))
            meta = {"name": n, "dtype": dtype, "nullable": nullable}
            if units and n in units:
                meta["unit"] = units[n]
            colmeta.append(meta)
        arrs = []
        for f, n in zip(fields, names):
            vals = cols[n]
            if isinstance(vals, np.ndarray) and vals.dtype.kind == "f":
                mask = np.isnan(vals)
                arrs.append(pa.array(vals, type=f.type, mask=mask))
            else:
                arrs.append(pa.array(list(vals), type=f.type))
        t = pa.Table.from_arrays(arrs, schema=pa.schema(fields))
        buf = io.BytesIO()
        pq.write_table(t, buf, compression="snappy", row_group_size=65536)
        data = buf.getvalue()
        rel = path or f"tables/{table}.parquet"
        self.files[rel] = data
        e = {"path": rel, "sha256": sha256_bytes(data), "bytes": len(data), "kind": "table", "table": table,
             "rows": t.num_rows, "columns": colmeta}
        if passthrough:
            e["passthrough"] = passthrough
        self.entries.append(e)

    def add_array(self, name: str, arr: np.ndarray, axes: list[str], unit: str | None = None):
        buf = io.BytesIO()
        np.save(buf, arr, allow_pickle=False)
        data = buf.getvalue()
        rel = f"arrays/{name}.npy"
        self.files[rel] = data
        self.entries.append({"path": rel, "sha256": sha256_bytes(data), "bytes": len(data), "kind": "array",
                             "array": {"name": name, "dtype": str(arr.dtype), "shape": list(arr.shape), "axes": axes,
                                       "unit": unit}})

    def add_provenance(self, config_text: str, command: str, extra_meta: dict):
        meta = json.dumps({"synthetic": True, **extra_meta}, indent=2).encode()
        for rel, data in [("provenance/metadata.json", meta), ("provenance/config_resolved.yaml", config_text.encode()),
                          ("provenance/command.txt", command.encode()),
                          ("provenance/console.log", b"[spec fixture] no console output: synthetic bundle\n")]:
            self.files[rel] = data
            self.entries.append({"path": rel, "sha256": sha256_bytes(data), "bytes": len(data), "kind": "provenance"})

    def finish(self, manifest: dict) -> dict:
        m = copy.deepcopy(manifest)
        m["files"] = sorted(self.entries, key=lambda e: e["path"])
        ident = sha256_bytes("".join(e["sha256"] for e in m["files"]).encode())
        m["bundle_id"] = f"pkt-{ident[:16]}"
        self.manifest = m
        return m

    def write(self, out: Path):
        d = out / f"{self.name}.pkt"
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        (d / "manifest.json").write_text(json.dumps(self.manifest, indent=2))
        for rel, data in self.files.items():
            p = d / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        z = out / f"{self.name}.pkt.zip"
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(f"{self.name}.pkt/manifest.json", json.dumps(self.manifest, indent=2))
            for rel, data in sorted(self.files.items()):
                zf.writestr(f"{self.name}.pkt/{rel}", data)


def base_manifest(workflow: str, model_id: str, variant: str, commit: str, config: str, issues: list[str],
                  params: list[str], states: list[str], layers: list[dict], param_meta: list[dict], groups: list[dict]) -> dict:
    return {
        "bundle_schema": SCHEMA,
        "bundle_id": "pending",
        "created_utc": FIXED_CREATED,
        "producer": {"phoskintime_version": "0.6.0.dev0", "git_commit": commit, "git_branch": "spec-fixture",
                     "git_dirty": False, "repository": "spec fixture (phoskintime-vis); not produced by PhosKinTime"},
        "workflows": [workflow],
        "model": {"model_id": model_id, "variant": variant},
        "config_sha256": sha256_bytes(config.encode()),
        "parameter_order_sha256": order_sha(params),
        "state_order_sha256": order_sha(states),
        "inputs": [{"name": "synthetic_timecourses.csv", "sha256": sha256_bytes(b"synthetic-inputs-" + workflow.encode()),
                    "bytes": 0, "description": "Synthetic; no input file exists."}],
        "layers": layers,
        "parameters": param_meta,
        "parameter_groups": groups,
        "missing": [],
        "skipped": [],
        "warnings": [dict(SPEC_WARNING)],
        "known_issues_open": [{"id": i, "severity": ISSUES[i][0], "status": "Not fixed", "title": ISSUES[i][1],
                               "text": f"{i}: {ISSUES[i][1]} (synthetic copy of the issue title for a spec fixture)."}
                              for i in issues],
        "known_issues_source": {"path": "KNOWN_ISSUES.md", "commit": commit},
    }


def curve(t, amp, tau1, tau2, base=1.0):
    return base + amp * (1 - np.exp(-t / tau1)) * np.exp(-t / tau2)


# --------------------------------------------------------------------------------------------
# small-protwise
# --------------------------------------------------------------------------------------------

def make_small_protwise(drop: set[str] | None = None, name: str = "small-protwise") -> Bundle:
    drop = drop or set()
    rng = np.random.default_rng(11)
    b = Bundle(name)
    proteins = [f"PROT{i}" for i in range(1, 6)]
    sites = {p: [f"S{10 * (j + 1)}" for j in range(1 + i % 3)] for i, p in enumerate(proteins)}
    states, state_rows = [], []
    for p in proteins:
        for layer, st, ps in [("rna", f"{p}_R", None), ("protein", f"{p}_P", None)] + [("phospho", f"{p}_{s}", s) for s in sites[p]]:
            state_rows.append((len(states), st, layer, p, ps))
            states.append(st)
    traj = {k: [] for k in ["workflow", "scenario", "sample_id", "layer", "protein", "psite", "state", "time", "value_obs", "value_pred"]}
    preds = {}
    for (_, st, layer, p, ps) in state_rows:
        amp, t1, t2 = rng.uniform(0.3, 2.0), rng.uniform(1, 20), rng.uniform(100, 900)
        pred = curve(TIMES, amp, t1, t2)
        obs = pred * (1 + rng.normal(0, 0.06, TIMES.size))
        obs[0] = 1.0 + rng.normal(0, 0.02)
        if layer == "rna":
            obs[:5] = np.nan  # RNA observed from t = 4
        if layer == "phospho" and rng.random() < 0.5:
            obs[rng.integers(6, TIMES.size)] = np.nan
        preds[st] = pred
        for t, o, pr in zip(TIMES, obs, pred):
            traj["workflow"].append("protwise"); traj["scenario"].append("fit"); traj["sample_id"].append("best")
            traj["layer"].append(layer); traj["protein"].append(p); traj["psite"].append(ps); traj["state"].append(st)
            traj["time"].append(float(t)); traj["value_obs"].append(o); traj["value_pred"].append(float(pr))
    traj["value_obs"] = np.array(traj["value_obs"], dtype=float)
    b.add_table("trajectories", traj, units={"time": "min", "value_obs": "fold change", "value_pred": "fold change"})

    params, pmeta, prow = [], [], {k: [] for k in ["workflow", "scenario", "sample_id", "name", "group", "label", "protein", "psite", "kinase", "value", "lower", "upper", "unit"]}
    groups = [{"id": "A", "label": "mRNA production (synthetic label)", "unit": "1/min"},
              {"id": "B", "label": "mRNA decay (synthetic label)", "unit": "1/min"},
              {"id": "C", "label": "translation (synthetic label)", "unit": "1/min"},
              {"id": "D", "label": "protein decay (synthetic label)", "unit": "1/min"},
              {"id": "S", "label": "phosphorylation (synthetic label)", "unit": "1/min"},
              {"id": "Dp", "label": None, "unit": None}]
    gl = {g["id"]: g for g in groups}
    for p in proteins:
        names = [(f"A_{p}", "A", None), (f"B_{p}", "B", None), (f"C_{p}", "C", None), (f"D_{p}", "D", None)]
        names += [(f"S_{p}_{s}", "S", s) for s in sites[p]] + [(f"Dp_{p}_{s}", "Dp", s) for s in sites[p]]
        for n, g, s in names:
            v = float(rng.lognormal(-1, 0.8))
            params.append(n)
            label = gl[g]["label"]
            pmeta.append({"name": n, "label": label, "group": g, "unit": gl[g]["unit"]})
            for k, val in zip(prow.keys(), ["protwise", "fit", "best", n, g, label, p, s, None, v, 1e-4, 50.0, gl[g]["unit"]]):
                prow[k].append(val)
    b.add_table("parameters", prow)
    b.add_table("state_index", {"index": [r[0] for r in state_rows], "state": [r[1] for r in state_rows],
                                "layer": [r[2] for r in state_rows], "protein": [r[3] for r in state_rows], "psite": [r[4] for r in state_rows]})

    met = {k: [] for k in ["workflow", "scenario", "layer", "protein", "metric", "value"]}
    for p in proteins:
        for m, v in [("mse", rng.uniform(0.001, 0.05)), ("regularization", rng.uniform(0.0, 0.01)), ("rmse", None), ("r2", rng.uniform(0.6, 0.99))]:
            if v is None:
                v = float(np.sqrt(met["value"][-2]))
            for k, val in zip(met.keys(), ["protwise", "fit", None, p, m, float(v)]):
                met[k].append(val)
    b.add_table("metrics", met)

    if "sensitivity" not in drop:
        sen = {k: [] for k in ["workflow", "protein", "output", "parameter", "mu", "mu_star", "sigma", "mu_star_conf"]}
        for p in proteins:
            for n in [x for x in params if x.split("_")[1] == p]:
                ms = float(rng.gamma(2, 0.05)); sg = float(ms * rng.uniform(0.2, 1.5))
                for k, val in zip(sen.keys(), ["protwise", p, f"{p}_P", n, ms * rng.choice([-1, 1]), ms, sg, ms * 0.1]):
                    sen[k].append(val)
        b.add_table("sensitivity", sen)

    if "embeddings" not in drop:
        emb = {k: [] for k in ["workflow", "protein", "method", "point_id", "label", "time", "x", "y", "explained_variance_x", "explained_variance_y"]}
        for p in proteins:
            for meth in ["pca", "tsne"]:
                for i, t in enumerate(TIMES):
                    x = np.log1p(t) * rng.uniform(0.8, 1.2) + rng.normal(0, 0.1); y = np.sin(i / 3) + rng.normal(0, 0.1)
                    for k, val in zip(emb.keys(), ["protwise", p, meth, f"{p}_t{i}", "early" if i < 8 else "late", float(t), float(x), float(y),
                                                   0.71 if meth == "pca" else None, 0.18 if meth == "pca" else None]):
                        emb[k].append(val)
        b.add_table("embeddings", emb)

    conv = {k: [] for k in ["workflow", "run", "iteration", "objective", "component"]}
    for p in proteins:
        obj = 1.0
        for it in range(60):
            obj *= rng.uniform(0.85, 0.99)
            for k, val in zip(conv.keys(), ["protwise", p, it, obj, "total"]):
                conv[k].append(val)
    b.add_table("convergence", conv)

    if "knockouts" not in drop:
        ko = {k: [] for k in ["workflow", "protein", "knockout", "state", "layer", "time", "value"]}
        for p in proteins:
            for kn, f in [("wild_type", 1.0), ("transcription", 0.2), ("translation", 0.4), ("phosphorylation", 0.0)]:
                st = f"{p}_{sites[p][0]}"
                for t, v in zip(TIMES, preds[st]):
                    val = 1 + (v - 1) * f
                    for k, x in zip(ko.keys(), ["protwise", p, kn, st, "phospho", float(t), float(val)]):
                        ko[k].append(x)
        b.add_table("knockouts", ko)

    pert = {k: [] for k in ["workflow", "protein", "perturbation", "state", "time", "value"]}
    for p in proteins:
        for j in range(30):
            scale = rng.lognormal(0, 0.25)
            for st in [f"{p}_R", f"{p}_P"] + [f"{p}_{s}" for s in sites[p]]:
                for t, v in zip(TIMES, preds[st]):
                    for k, x in zip(pert.keys(), ["protwise", p, f"pert{j}", st, float(t), float(1 + (v - 1) * scale)]):
                        pert[k].append(x)
    b.add_table("perturbations", pert)

    prof = {k: [] for k in ["workflow", "protein", "parameter", "parameter_value", "state", "time", "value"]}
    for p in proteins[:3]:
        for pn in [f"A_{p}", f"D_{p}"]:
            for pv in np.linspace(0.1, 2.0, 6):
                for t, v in zip(TIMES, preds[f"{p}_P"]):
                    for k, x in zip(prof.keys(), ["protwise", p, pn, float(pv), f"{p}_P", float(t), float(1 + (v - 1) * pv)]):
                        prof[k].append(x)
    b.add_table("parameter_profiles", prof)

    # a pass-through table: a sheet of a results workbook converted 1:1
    b.add_table("passthrough_fit_summary", {"Gene": proteins, "Total_Error": [float(x) for x in rng.uniform(0, 1, 5)]},
                passthrough={"source_path": "results/protwise/PROT_results.xlsx", "sheet": "Summary"},
                path="tables/passthrough/fit_summary.parquet")

    config = "workflow: protwise\nmodel: distributive\nseed: 11\n# spec fixture\n"
    b.add_provenance(config, "phoskintime model --spec-fixture", {"fixture": name})
    layers = [{"id": "rna", "label": "mRNA", "unit": "fold change", "fold_change_baseline": {"time": 4.0, "method": "Y[t]/Y[t_base]", "note": "synthetic"}},
              {"id": "protein", "label": "Protein", "unit": "fold change", "fold_change_baseline": {"time": 0.0, "method": "Y[t]/Y[t_base]"}},
              {"id": "phospho", "label": "Phosphosite", "unit": "fold change", "fold_change_baseline": {"time": 0.0, "method": "Y[t]/Y[t_base]"}}]
    m = base_manifest("protwise", "distributive", "distributive", "a34adec" + "0" * 33, config, ["P1", "P3"],
                      params, states, layers, pmeta, groups)
    m["missing"].append({"artifact": "steady_state", "reason": "Spec fixture: protwise does not save steady-state dynamics data (plot only).", "workflow": "protwise"})
    for d in sorted(drop):
        m["missing"].append({"artifact": d, "reason": f"Spec fixture 'partial': '{d}' deliberately left out to test the not-available card.", "workflow": "protwise"})
    b.finish(m)
    return b


# --------------------------------------------------------------------------------------------
# network (large)
# --------------------------------------------------------------------------------------------

def make_network(variant: str = "base") -> Bundle:
    """variant: 'base' | 'after-fix' | 'reordered'."""
    rng = np.random.default_rng(2026)
    name = {"base": "network", "after-fix": "network-after-fix", "reordered": "reordered-params"}[variant]
    b = Bundle(name)
    n_prot, n_kin = 100, 30
    proteins = [f"G{i:03d}" for i in range(1, n_prot + 1)]
    kinases = [f"K{i:02d}" for i in range(1, n_kin + 1)]
    sites = {p: [f"S{(i * 7) % 400 + 1}", f"T{(i * 13) % 400 + 1}"] for i, p in enumerate(proteins)}
    state_rows = []
    for p in proteins:
        state_rows.append((f"{p}_R", "rna", p, None))
        state_rows.append((f"{p}_P", "protein", p, None))
        for s in sites[p]:
            state_rows.append((f"{p}_{s}", "phospho", p, s))
    states = [r[0] for r in state_rows]
    shapes = {st: (rng.uniform(0.2, 2.5), rng.uniform(1, 30), rng.uniform(80, 1500)) for st in states}
    fix = variant in ("after-fix", "reordered")
    rng_fix = np.random.default_rng(7)

    # parameters: 200
    groups = [{"id": "A", "label": "synthesis (synthetic label)", "unit": "1/min"},
              {"id": "B", "label": "degradation (synthetic label)", "unit": "1/min"},
              {"id": "C", "label": "translation (synthetic label)", "unit": "1/min"},
              {"id": "E", "label": None, "unit": None},
              {"id": "c_k", "label": "kinase scale (synthetic label)", "unit": "dimensionless"},
              {"id": "tf_scale", "label": "TF scale (synthetic label)", "unit": "dimensionless"}]
    gl = {g["id"]: g for g in groups}
    plist = []
    for g in ["A", "B", "C", "E"]:
        for p in proteins[:40]:
            plist.append((f"{g}_{p}", g, p, None))
    for k in kinases:
        plist.append((f"c_k_{k}", "c_k", None, k))
    for p in proteins[:10]:
        plist.append((f"tf_scale_{p}", "tf_scale", p, None))
    assert len(plist) == 200
    base_vals = rng.lognormal(-1.5, 0.9, len(plist))
    vals = base_vals.copy()
    if fix:
        f = rng_fix.lognormal(0, 0.12, len(plist))
        e_idx = [i for i, x in enumerate(plist) if x[1] == "E"]
        f[e_idx] *= 1.8  # the "fix" mostly moves the E group
        vals = base_vals * f
    order = list(range(len(plist)))
    extra = []
    if variant == "reordered":
        order = list(np.random.default_rng(3).permutation(len(plist)))
        order = [i for i in order if plist[i][0] != "tf_scale_G010"]  # one parameter removed ...
        extra = [("Dp_G001", "Dp", "G001", None)]  # ... and one added: unmatched rows on both sides
    pmeta = []
    prow = {k: [] for k in ["workflow", "scenario", "sample_id", "name", "group", "label", "protein", "psite", "kinase", "value", "lower", "upper", "unit"]}
    plist_out = [plist[i] for i in order] + extra
    vals_out = [vals[i] for i in order] + [0.05]
    if not extra:
        vals_out = vals_out[:-1]
    for (n, g, p, k), v in zip(plist_out, vals_out):
        gm = gl.get(g, {"label": None, "unit": None})
        label = None if g in ("E", "Dp") else gm["label"]
        pmeta.append({"name": n, "label": label, "group": g, "unit": gm["unit"]})
        for key, val in zip(prow.keys(), ["networkmodel", "fit", "best", n, g, label, p, None, k, float(v), 1e-5, 100.0, gm["unit"]]):
            prow[key].append(val)
    b.add_table("parameters", prow)
    param_names = [x[0] for x in plist_out]

    b.add_table("state_index", {"index": list(range(len(states))), "state": states, "layer": [r[1] for r in state_rows],
                                "protein": [r[2] for r in state_rows], "psite": [r[3] for r in state_rows]})

    # trajectories: 400 states x 20 samples (best + 19 posterior predictive) x 14 times = 112,000 rows
    n_samples = 20
    T = TIMES.size
    rows = len(states) * n_samples * T
    col = {k: [None] * rows for k in ["workflow", "scenario", "sample_id", "layer", "protein", "psite", "state"]}
    time_arr = np.tile(TIMES, len(states) * n_samples)
    obs_arr = np.full(rows, np.nan)
    pred_arr = np.empty(rows)
    i = 0
    rng_obs = np.random.default_rng(99)
    for (st, layer, p, ps) in state_rows:
        amp, t1, t2 = shapes[st]
        if fix:
            amp *= 1 + 0.15 * np.tanh(rng_fix.normal())
            t1 *= rng_fix.lognormal(0, 0.1)
        best = curve(TIMES, amp, t1, t2)
        obs = curve(TIMES, *shapes[st]) * (1 + rng_obs.normal(0, 0.08, T))
        if layer == "rna":
            obs[:5] = np.nan
        miss = rng_obs.random(T) < 0.04
        obs[miss] = np.nan
        for s in range(n_samples):
            sid = "best" if s == 0 else f"ppc{s:02d}"
            pred = best if s == 0 else best * (1 + rng.normal(0, 0.05, T)) + rng.normal(0, 0.03)
            sl = slice(i, i + T)
            for k, v in [("workflow", "networkmodel"), ("scenario", "fit" if s == 0 else "posterior_predictive"), ("sample_id", sid),
                         ("layer", layer), ("protein", p), ("psite", ps), ("state", st)]:
                col[k][sl] = [v] * T
            pred_arr[sl] = pred
            if s == 0:
                obs_arr[sl] = obs
            i += T
    traj = {**{k: col[k] for k in ["workflow", "scenario", "sample_id", "layer", "protein", "psite", "state"]},
            "time": time_arr, "value_obs": obs_arr, "value_pred": pred_arr}
    b.add_table("trajectories", traj, units={"time": "min", "value_obs": "fold change", "value_pred": "fold change"})

    # metrics computed from best fit
    met = {k: [] for k in ["workflow", "scenario", "layer", "protein", "metric", "value"]}
    best_mask = np.array([sid == "best" for sid in col["sample_id"]])
    layers_arr = np.array(col["layer"])
    for layer in [None, "rna", "protein", "phospho"]:
        m = best_mask & ~np.isnan(obs_arr) & (True if layer is None else (layers_arr == layer))
        r = obs_arr[m] - pred_arr[m]
        mse = float(np.mean(r ** 2))
        for mname, v in [("mse", mse), ("rmse", float(np.sqrt(mse))), ("n_obs", float(m.sum()))]:
            for k, x in zip(met.keys(), ["networkmodel", "fit", layer, None, mname, v]):
                met[k].append(x)
    for mname, v in [("loss_total", 0.42 if not fix else 0.37), ("loss_regularization", 0.031), ("runtime_s", 512.0)]:
        for k, x in zip(met.keys(), ["networkmodel", "fit", None, None, mname, v]):
            met[k].append(x)
    b.add_table("metrics", met)

    sen = {k: [] for k in ["workflow", "protein", "output", "parameter", "mu", "mu_star", "sigma", "mu_star_conf"]}
    for out in ["rna", "protein", "phospho"]:
        for n in param_names:
            ms = float(rng.gamma(1.5, 0.04)); sg = float(ms * rng.uniform(0.3, 2.0))
            for k, x in zip(sen.keys(), ["networkmodel", None, out, n, ms, ms, sg, 0.1 * ms]):
                sen[k].append(x)
    b.add_table("sensitivity", sen)

    conv = {k: [] for k in ["workflow", "run", "iteration", "objective", "component"]}
    ms_tab = {k: [] for k in ["workflow", "start", "objective", "converged", "selected"]}
    finals = []
    for s in range(20):
        obj = rng.uniform(2, 6)
        for it in range(200):
            obj = obj * rng.uniform(0.95, 0.999) + 0.0005
            for k, x in zip(conv.keys(), ["networkmodel", f"start{s:02d}", it, float(obj), "total"]):
                conv[k].append(x)
        finals.append(obj)
    best_s = int(np.argmin(finals))
    for s, fv in enumerate(finals):
        for k, x in zip(ms_tab.keys(), ["networkmodel", s, float(fv), bool(fv < np.median(finals) * 1.3), s == best_s]):
            ms_tab[k].append(x)
    b.add_table("convergence", conv)
    b.add_table("multistart", ms_tab)

    par = {k: [] for k in ["workflow", "solution", "objective", "value", "selected"]}
    for sidx in range(60):
        a = rng.uniform(0.05, 1.0); f1 = a; f2 = 0.2 / (a + 0.05) + rng.normal(0, 0.02); f3 = rng.uniform(0, 0.1)
        for oname, v in [("rna_mse", f1), ("protein_mse", f2), ("phospho_mse", f3)]:
            for k, x in zip(par.keys(), ["networkmodel", sidx, oname, float(v), sidx == 17]):
                par[k].append(x)
    b.add_table("pareto", par)

    pl = {k: [] for k in ["workflow", "name", "grid_value", "delta", "space", "statistic"]}
    for n in param_names[:6]:
        for gv in np.linspace(-3, 3, 10):
            for k, x in zip(pl.keys(), ["networkmodel", n, float(gv), float((gv - rng.normal(0, 0.3)) ** 2 * rng.uniform(0.01, 0.1)),
                                         "raw_softplus", "mse_delta"]):
                pl[k].append(x)
    b.add_table("profile_likelihood", pl, units={"grid_value": "raw softplus space"})

    knots = np.array([0.0, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 60.0, 120.0])
    ka = {k: [] for k in ["workflow", "kinase", "time", "value", "representation"]}
    for kname in kinases:
        kv = curve(knots, rng.uniform(0.3, 3), rng.uniform(0.5, 10), rng.uniform(30, 300))
        reps = ["export_linear"] + (["rhs_step"] if fix else [])
        for rep in reps:
            for t, v in zip(knots, kv):
                for k, x in zip(ka.keys(), ["networkmodel", kname, float(t), float(v), rep]):
                    ka[k].append(x)
    b.add_table("kinase_activity", ka, units={"time": "min"})

    ss = {k: [] for k in ["workflow", "protein", "state", "time", "value", "dydt_abs"]}
    for (st, layer, p, ps) in state_rows[:80]:
        for t in [0.0, 960.0, 5000.0, 20000.0]:
            for k, x in zip(ss.keys(), ["networkmodel", p, st, t, float(1 + rng.normal(0, 0.1)), float(abs(rng.normal(0, 1e-3)) * np.exp(-t / 2000))]):
                ss[k].append(x)
    b.add_table("steady_state", ss, units={"time": "min"})

    # posterior draws 4 x 500 x n_params, in parameters-table order
    nP = len(param_names)
    centre = np.log(np.array(vals_out))
    chains = np.empty((4, 500, nP))
    for c in range(4):
        x = centre + rng.normal(0, 0.3, nP)
        for d in range(500):
            x = 0.9 * x + 0.1 * centre + rng.normal(0, 0.08, nP)
            chains[c, d] = x
    b.add_array("posterior_draws", np.exp(chains), ["chain", "draw", "parameter"])

    W = (rng.random((len([r for r in state_rows if r[1] == "phospho"]), n_kin)) < 0.06) * rng.uniform(0.1, 1.0, (200, n_kin))
    b.add_array("matrix_W_site_kinase", W.astype(np.float64), ["site", "kinase"])
    ml = {k: [] for k in ["matrix", "axis", "position", "label"]}
    for pos, r in enumerate([r for r in state_rows if r[1] == "phospho"]):
        for k, x in zip(ml.keys(), ["matrix_W_site_kinase", 0, pos, r[0]]):
            ml[k].append(x)
    for pos, kname in enumerate(kinases):
        for k, x in zip(ml.keys(), ["matrix_W_site_kinase", 1, pos, kname]):
            ml[k].append(x)
    b.add_table("matrix_labels", ml)

    config = f"workflow: networkmodel\nmodel_id: 0\nrtol: {'1e-8' if fix else '1e-6'}\n# spec fixture {variant}\n"
    b.add_provenance(config, "phoskintime networkmodel --spec-fixture", {"fixture": name})
    layers = [{"id": "rna", "label": "mRNA", "unit": "fold change",
               "fold_change_baseline": {"time": 4.0, "method": "Y[t]/Y[t_base]", "note": "hard-coded 4.0 (N7)" if not fix else "configured"}},
              {"id": "protein", "label": "Protein", "unit": "fold change", "fold_change_baseline": {"time": 0.0, "method": "Y[t]/Y[t_base]"}},
              {"id": "phospho", "label": "Phosphosite", "unit": "fold change", "fold_change_baseline": {"time": 0.0, "method": "Y[t]/Y[t_base]"}}]
    issues = ["N1", "N5", "N6", "N7", "N8", "N9", "N10", "N17"]
    commit = "e634e17" + "0" * 33
    if fix:
        issues = ["N1", "N6", "N8", "N9", "N10"]
        commit = "f1f1f1f" + "0" * 33
    m = base_manifest("networkmodel", "0", "distributive", commit, config, issues, param_names, states, layers, pmeta, groups)
    m["warnings"].append({"code": "TOLERANCE", "message": "Synthetic warning: fit used rtol=atol=1e-6, not the configured 1e-8.", "issue": "N5"} if not fix
                         else {"code": "NOTE", "message": "Synthetic warning: spec fixture representing a run after N5/N7/N17 fixes."})
    if not fix:
        m["missing"].append({"artifact": "kinase_activity:rhs_step", "reason": "Only the linearly interpolated export exists (KNOWN_ISSUES N17).", "workflow": "networkmodel"})
    m["skipped"].append({"artifact": "pinn", "reason": "Spec fixture: PINN path not run.", "workflow": "networkmodel"})
    b.finish(m)
    return b


def make_tampered(out: Path):
    b = make_small_protwise(name="tampered")
    key = "tables/metrics.parquet"
    data = bytearray(b.files[key])
    data[len(data) // 2] ^= 0xFF
    b.files[key] = bytes(data)  # manifest keeps the original sha256 -> mismatch
    return b


def make_future_major():
    b = make_small_protwise(name="future-major")
    b.manifest["bundle_schema"] = "2.0"
    return b


def make_partial():
    return make_small_protwise(drop={"sensitivity", "embeddings", "knockouts"}, name="partial")


BUILDERS = {
    "small-protwise": lambda: make_small_protwise(),
    "network": lambda: make_network("base"),
    "network-after-fix": lambda: make_network("after-fix"),
    "reordered-params": lambda: make_network("reordered"),
    "partial": make_partial,
    "tampered": lambda: make_tampered(None),
    "future-major": make_future_major,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).parent / "out"))
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in BUILDERS.items():
        if a.only and name not in a.only:
            continue
        b = fn()
        b.write(out)
        print(f"{name}: {b.manifest['bundle_id']} files={len(b.files)} bytes={sum(len(v) for v in b.files.values())}")


if __name__ == "__main__":
    main()
