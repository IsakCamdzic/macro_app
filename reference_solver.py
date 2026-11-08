#!/usr/bin/env python3
"""
Independent reference solver for MacroMeal (used to cross-check the TypeScript solver).

Formulation (must match ARCHITECTURE.md section 5.2):
  minimise  sum_k (w_k * (A g - T')_k)^2  +  lam * sum_i (g_i - g0_i)^2
  subject to 0 <= g_i <= max_i       (absolute gram errors, protein weight 2)
Locked foods are subtracted from the target first. Result is rounded to `step` grams.

Usage:
  pip install numpy scipy
  python reference_solver.py --demo                       # prints the golden cases
  python reference_solver.py --gen 500 reference-cases.json   # writes random cases for the TS test
"""
import sys, json
import numpy as np
from scipy.optimize import lsq_linear

W = (2.0, 1.0, 1.0)     # protein, carbs, fat
LAM = 1e-4

# per 100 g: protein, carbs, fat | default portion g0 | max grams
FOODS = {
    "chicken":  dict(p=23.0, c=0.0,  f=1.2,   g0=150, mx=1000),
    "rice":     dict(p=7.0,  c=80.0, f=0.6,   g0=100, mx=1000),
    "broccoli": dict(p=2.8,  c=7.0,  f=0.4,   g0=150, mx=1000),
    "oil":      dict(p=0.0,  c=0.0,  f=100.0, g0=10,  mx=60),
    "oats":     dict(p=13.0, c=68.0, f=7.0,   g0=60,  mx=1000),
    "pb":       dict(p=25.0, c=20.0, f=50.0,  g0=15,  mx=100),
}

def macros(name, grams):
    f = FOODS[name]
    return np.array([f["p"], f["c"], f["f"]]) * grams / 100.0

def solve(target, names, locked=None, step=1):
    locked = locked or {}
    T = np.array(target, float)
    for n, g in locked.items():
        T = T - macros(n, g)
    T = np.maximum(T, 0)
    auto = [n for n in names if n not in locked]
    out = {n: float(g) for n, g in locked.items()}
    if auto:
        A = np.array([[FOODS[n]["p"], FOODS[n]["c"], FOODS[n]["f"]] for n in auto]).T / 100.0
        w = np.array(W)
        g0 = np.array([FOODS[n]["g0"] for n in auto], float)
        M = np.vstack([A * w[:, None], np.sqrt(LAM) * np.eye(len(auto))])
        y = np.concatenate([T * w, np.sqrt(LAM) * g0])
        ub = np.array([FOODS[n]["mx"] for n in auto], float)
        r = lsq_linear(M, y, bounds=(0, ub), method="bvls", tol=1e-12)
        for n, x in zip(auto, np.round(r.x / step) * step):
            out[n] = float(x)
    achieved = sum((macros(n, g) for n, g in out.items()), np.zeros(3))
    return out, achieved

def demo():
    cases = [
        ("A infeasible (no fat source)", (50, 52.5, 25), ["chicken", "rice", "broccoli"], {"broccoli": 150}),
        ("B exact (with oil)",           (50, 52.5, 25), ["chicken", "rice", "broccoli", "oil"], {"broccoli": 150}),
        ("C1 two foods",                 (40, 60, 15),   ["chicken", "rice"], None),
        ("C2 add oil",                   (40, 60, 15),   ["chicken", "rice", "oil"], None),
        ("D four foods",                 (50, 52.5, 25), ["chicken", "rice", "oats", "oil"], None),
        ("E zero-fat target",            (40, 50, 0),    ["chicken", "rice"], None),
        ("F chicken locked 200",         (50, 52.5, 25), ["chicken", "rice", "oil"], {"chicken": 200}),
    ]
    for label, t, names, locked in cases:
        o, a = solve(t, names, locked)
        print(f"{label:32s} {({k: round(v) for k, v in o.items()})}  achieved P/C/F = {a.round(2).tolist()}")

def gen(n, path, seed=7):
    rng = np.random.default_rng(seed)
    names = list(FOODS)
    cases = []
    for _ in range(n):
        k = int(rng.integers(1, 6))
        sel = [str(x) for x in rng.choice(names, k, replace=False)]
        target = [round(float(x), 1) for x in rng.uniform(0, 80, 3)]
        locked = {}
        if k > 1 and rng.random() < 0.3:
            ln = sel[int(rng.integers(0, k))]
            locked[ln] = float(round(rng.uniform(10, 250)))
        o, a = solve(target, sel, locked)
        cases.append(dict(target=target, foods=sel, locked=locked,
                          ref_grams=o, ref_achieved=[round(float(x), 3) for x in a]))
    json.dump(dict(weights=W, lam=LAM, foods=FOODS, cases=cases), open(path, "w"), indent=1)
    print(f"wrote {len(cases)} cases to {path}")

if __name__ == "__main__":
    if "--gen" in sys.argv:
        i = sys.argv.index("--gen")
        gen(int(sys.argv[i + 1]), sys.argv[i + 2])
    else:
        demo()
