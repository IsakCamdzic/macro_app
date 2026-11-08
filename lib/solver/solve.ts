import { Macros, SolverFood, SolverInput, SolverItemResult, SolverResult } from "./types";
import { generateSuggestionsAndNotes } from "./suggest";

export function kcalFromMacros(macros: Macros): number {
  return Math.round(4 * macros.protein + 4 * macros.carbs + 9 * macros.fat);
}

function getDefaultPrior(food: SolverFood): { g0: number; maxG: number } {
  const isFatSource = food.per100.fat >= 40;
  const isCarbSource = food.per100.carbs >= 40;
  const isProteinSource = food.per100.protein >= 15;

  let g0 = food.defaultGrams;
  if (g0 === undefined || g0 <= 0) {
    if (isFatSource) g0 = 10;
    else if (isCarbSource) g0 = 100;
    else if (isProteinSource) g0 = 150;
    else g0 = 150;
  }

  let maxG = food.maxGrams;
  if (maxG === undefined || maxG <= 0) {
    maxG = isFatSource ? 60 : 1000;
  }

  return { g0, maxG };
}

export function solveMeal(input: SolverInput): SolverResult {
  const { target, foods, roundTo = 1 } = input;

  // Separate zero-calorie foods (water, spices, zero cal drinks)
  const nonZeroFoods: SolverFood[] = [];
  const zeroCalItems: SolverItemResult[] = [];

  for (const food of foods) {
    const totalMacros100 = food.per100.protein + food.per100.carbs + food.per100.fat;
    if (totalMacros100 < 0.05) {
      const g = food.fixedGrams ?? food.defaultGrams ?? 0;
      zeroCalItems.push({
        foodId: food.id,
        foodName: food.name,
        grams: g,
        macros: { protein: 0, carbs: 0, fat: 0 },
        isFixed: true,
      });
    } else {
      nonZeroFoods.push(food);
    }
  }

  // 1. Separate fixed vs auto foods
  const fixedFoods = nonZeroFoods.filter((f) => f.mode === "fixed");
  const autoFoods = nonZeroFoods.filter((f) => f.mode === "auto");

  // Sum fixed foods macros
  let fixedP = 0;
  let fixedC = 0;
  let fixedF = 0;
  const fixedResults: SolverItemResult[] = [];

  for (const f of fixedFoods) {
    const grams = Math.max(0, f.fixedGrams ?? f.defaultGrams ?? 0);
    const p = (grams * f.per100.protein) / 100;
    const c = (grams * f.per100.carbs) / 100;
    const fat = (grams * f.per100.fat) / 100;
    fixedP += p;
    fixedC += c;
    fixedF += fat;
    fixedResults.push({
      foodId: f.id,
      foodName: f.name,
      grams,
      macros: {
        protein: Number(p.toFixed(1)),
        carbs: Number(c.toFixed(1)),
        fat: Number(fat.toFixed(1)),
      },
      isFixed: true,
    });
  }

  // Residual target T' (clamp each component at 0)
  const residualT: Macros = {
    protein: Math.max(0, target.protein - fixedP),
    carbs: Math.max(0, target.carbs - fixedC),
    fat: Math.max(0, target.fat - fixedF),
  };

  const n = autoFoods.length;
  let autoGrams: number[] = [];

  if (n > 0) {
    // Relative scaling factors: max(T'_k, 1)
    const Sp = Math.max(residualT.protein, 1);
    const Sc = Math.max(residualT.carbs, 1);
    const Sf = Math.max(residualT.fat, 1);

    // Matrix A: 3 x n in relative units (A[k][i] = per100_i[k] / 100 / S_k)
    const Ap: number[] = new Array(n);
    const Ac: number[] = new Array(n);
    const Af: number[] = new Array(n);

    const l: number[] = new Array(n);
    const u: number[] = new Array(n);
    const g0: number[] = new Array(n);
    const R: number[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const food = autoFoods[i];
      Ap[i] = food.per100.protein / 100 / Sp;
      Ac[i] = food.per100.carbs / 100 / Sc;
      Af[i] = food.per100.fat / 100 / Sf;

      const { g0: priorG0, maxG } = getDefaultPrior(food);
      g0[i] = priorG0;
      l[i] = Math.max(0, food.minGrams ?? 0);
      u[i] = Math.max(l[i], food.maxGrams ?? maxG);
      R[i] = Math.max(g0[i], 1);
    }

    const lambda = 1e-3;

    // Normalised targets
    const Tp = residualT.protein / Sp;
    const Tc = residualT.carbs / Sc;
    const Tf = residualT.fat / Sf;

    // Initialize grams with g0 clamped to [l, u]
    const g: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      g[i] = Math.max(l[i], Math.min(u[i], g0[i]));
    }

    // Precompute denominator for 1D updates:
    // f''(g_i) = 2 * (Ap_i^2 + Ac_i^2 + Af_i^2) + 2 * lambda / R_i^2
    const denom: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      denom[i] = 2 * (Ap[i] * Ap[i] + Ac[i] * Ac[i] + Af[i] * Af[i]) + (2 * lambda) / (R[i] * R[i]);
    }

    // Residual tracking
    let rp = -Tp;
    let rc = -Tc;
    let rf = -Tf;
    for (let i = 0; i < n; i++) {
      rp += Ap[i] * g[i];
      rc += Ac[i] * g[i];
      rf += Af[i] * g[i];
    }

    // Coordinate descent sweeps (200 sweeps guarantees high precision)
    const maxSweeps = 250;
    for (let iter = 0; iter < maxSweeps; iter++) {
      let maxChange = 0;
      for (let i = 0; i < n; i++) {
        // Gradient along g_i
        const grad = 2 * (Ap[i] * rp + Ac[i] * rc + Af[i] * rf) + (2 * lambda * (g[i] - g0[i])) / (R[i] * R[i]);
        const delta = -grad / denom[i];
        const nextGi = Math.max(l[i], Math.min(u[i], g[i] + delta));
        const actualDelta = nextGi - g[i];

        if (Math.abs(actualDelta) > 1e-9) {
          g[i] = nextGi;
          rp += Ap[i] * actualDelta;
          rc += Ac[i] * actualDelta;
          rf += Af[i] * actualDelta;
          if (Math.abs(actualDelta) > maxChange) {
            maxChange = Math.abs(actualDelta);
          }
        }
      }
      if (maxChange < 1e-7) break;
    }

    // Local search for rounding to roundTo (1g or 5g)
    // First round standardly
    const rounded: number[] = g.map((val, idx) => {
      const r = Math.round(val / roundTo) * roundTo;
      return Math.max(l[idx], Math.min(u[idx], r));
    });

    // Small local search: if n <= 4, try combinations of [-roundTo, 0, +roundTo]
    if (n <= 4) {
      let bestGrams = [...rounded];
      let bestCost = evaluateError(bestGrams, autoFoods, residualT, roundTo);

      // Generate perturbations
      const steps = [0, -roundTo, roundTo];
      const testCandidates = (foodIdx: number, currentGrams: number[]) => {
        if (foodIdx === n) {
          const cost = evaluateError(currentGrams, autoFoods, residualT, roundTo);
          if (cost < bestCost) {
            bestCost = cost;
            bestGrams = [...currentGrams];
          }
          return;
        }

        const baseVal = rounded[foodIdx];
        for (const step of steps) {
          const testVal = Math.max(l[foodIdx], Math.min(u[foodIdx], baseVal + step));
          currentGrams[foodIdx] = testVal;
          testCandidates(foodIdx + 1, currentGrams);
        }
      };

      testCandidates(0, new Array(n));
      autoGrams = bestGrams;
    } else {
      autoGrams = rounded;
    }
  }

  // Combine results
  const items: SolverItemResult[] = [...fixedResults];

  let totalAchievedP = fixedP;
  let totalAchievedC = fixedC;
  let totalAchievedF = fixedF;

  for (let i = 0; i < autoFoods.length; i++) {
    const food = autoFoods[i];
    const grams = autoGrams[i];
    const p = (grams * food.per100.protein) / 100;
    const c = (grams * food.per100.carbs) / 100;
    const fat = (grams * food.per100.fat) / 100;

    totalAchievedP += p;
    totalAchievedC += c;
    totalAchievedF += fat;

    items.push({
      foodId: food.id,
      foodName: food.name,
      grams,
      macros: {
        protein: Number(p.toFixed(1)),
        carbs: Number(c.toFixed(1)),
        fat: Number(fat.toFixed(1)),
      },
      isFixed: false,
    });
  }

  // Add zero cal items
  items.push(...zeroCalItems);

  // Re-sort items by original food order in input
  items.sort((a, b) => {
    const idxA = foods.findIndex((f) => f.id === a.foodId);
    const idxB = foods.findIndex((f) => f.id === b.foodId);
    return idxA - idxB;
  });

  const achieved: Macros = {
    protein: Number(totalAchievedP.toFixed(1)),
    carbs: Number(totalAchievedC.toFixed(1)),
    fat: Number(totalAchievedF.toFixed(1)),
  };

  const delta: Macros = {
    protein: Number((achieved.protein - target.protein).toFixed(1)),
    carbs: Number((achieved.carbs - target.carbs).toFixed(1)),
    fat: Number((achieved.fat - target.fat).toFixed(1)),
  };

  const status = classifyStatus(target, achieved);
  const kcal = kcalFromMacros(achieved);

  // Suggestions and notes
  const { suggestions, notes } = generateSuggestionsAndNotes(input, achieved, delta, status);

  return {
    status,
    items,
    achieved,
    delta,
    kcal,
    suggestions,
    notes,
  };
}

function evaluateError(grams: number[], foods: SolverFood[], target: Macros, roundTo: number): number {
  let p = 0;
  let c = 0;
  let f = 0;
  for (let i = 0; i < foods.length; i++) {
    p += (grams[i] * foods[i].per100.protein) / 100;
    c += (grams[i] * foods[i].per100.carbs) / 100;
    f += (grams[i] * foods[i].per100.fat) / 100;
  }
  const ep = (p - target.protein) / Math.max(target.protein, 1);
  const ec = (c - target.carbs) / Math.max(target.carbs, 1);
  const ef = (f - target.fat) / Math.max(target.fat, 1);
  return ep * ep + ec * ec + ef * ef;
}

/**
 * Status classification per §5.3:
 * - exact: every macro within max(1 g, 2%) of target
 * - close: every macro within 10% (or max 2g) of target
 * - infeasible: otherwise
 */
export function classifyStatus(target: Macros, achieved: Macros): "exact" | "close" | "infeasible" {
  const diffP = Math.abs(achieved.protein - target.protein);
  const diffC = Math.abs(achieved.carbs - target.carbs);
  const diffF = Math.abs(achieved.fat - target.fat);

  const exactP = diffP <= Math.max(1, 0.02 * target.protein);
  const exactC = diffC <= Math.max(1, 0.02 * target.carbs);
  const exactF = diffF <= Math.max(1, 0.02 * target.fat);

  if (exactP && exactC && exactF) {
    return "exact";
  }

  const closeP = diffP <= Math.max(2, 0.1 * target.protein);
  const closeC = diffC <= Math.max(2, 0.1 * target.carbs);
  const closeF = diffF <= Math.max(2, 0.1 * target.fat);

  if (closeP && closeC && closeF) {
    return "close";
  }

  return "infeasible";
}
