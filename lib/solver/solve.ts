import { Macros, SolverFood, SolverInput, SolverItemResult, SolverResult } from "./types";
import { generateSuggestionsAndNotes } from "./suggest";

export function kcalFromMacros(macros: Macros): number {
  return Math.round(4 * macros.protein + 4 * macros.carbs + 9 * macros.fat);
}

function getDefaultPrior(food: SolverFood): { g0: number; minG: number; maxG: number } {
  const isFatSource = food.per100.fat >= 40 || food.name.toLowerCase().includes("oil");
  const isCarbSource = food.per100.carbs >= 40;
  const isProteinSource = food.per100.protein >= 15;
  const isOats = food.name.toLowerCase().includes("oat");

  let g0 = food.defaultGrams;
  if (g0 === undefined || g0 <= 0) {
    if (isFatSource) g0 = 10;
    else if (isOats) g0 = 60;
    else if (isCarbSource) g0 = 100;
    else if (isProteinSource) g0 = 150;
    else g0 = 150;
  }

  let minG = food.minGrams !== undefined ? Math.max(0, food.minGrams) : 0;

  let maxG = food.maxGrams;
  if (maxG === undefined || maxG <= 0) {
    maxG = isFatSource ? 60 : 1000;
  }

  return { g0, minG, maxG };
}

/**
 * Solve a linear system A * x = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row) => [...row]);
  const x = [...b];

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      const val = Math.abs(M[k][i]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = k;
      }
    }

    if (maxVal < 1e-12) {
      // Degenerate/singular fallback
      return new Array(n).fill(0);
    }

    if (maxRow !== i) {
      const tempRow = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tempRow;
      const tempB = x[i];
      x[i] = x[maxRow];
      x[maxRow] = tempB;
    }

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j < n; j++) {
        M[k][j] -= factor * M[i][j];
      }
      x[k] -= factor * x[i];
    }
  }

  const sol = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * sol[j];
    }
    sol[i] = sum / M[i][i];
  }

  return sol;
}

export function solveMeal(input: SolverInput): SolverResult {
  const { target, foods, roundTo = 1 } = input;

  // Separate zero-calorie foods (water, spices, zero-calorie condiments)
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

  // Separate fixed vs auto foods
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
        protein: Number(p.toFixed(2)),
        carbs: Number(c.toFixed(2)),
        fat: Number(fat.toFixed(2)),
      },
      isFixed: true,
    });
  }

  // Residual target T' (clamped at 0 for auto solving)
  const residualT: Macros = {
    protein: Math.max(0, target.protein - fixedP),
    carbs: Math.max(0, target.carbs - fixedC),
    fat: Math.max(0, target.fat - fixedF),
  };

  const n = autoFoods.length;
  let autoGrams: number[] = [];

  if (n > 0) {
    const W = [2.0, 1.0, 1.0]; // protein, carbs, fat
    const LAM = 1e-4;

    const lb = new Array(n);
    const ub = new Array(n);
    const g0 = new Array(n);

    // Aw matrix: 3 x n where Aw[k][i] = W[k] * per100_i[k] / 100
    const Aw: number[][] = [new Array(n), new Array(n), new Array(n)];

    for (let i = 0; i < n; i++) {
      const f = autoFoods[i];
      const priors = getDefaultPrior(f);
      lb[i] = priors.minG;
      ub[i] = priors.maxG;
      g0[i] = priors.g0;

      Aw[0][i] = (W[0] * f.per100.protein) / 100;
      Aw[1][i] = (W[1] * f.per100.carbs) / 100;
      Aw[2][i] = (W[2] * f.per100.fat) / 100;
    }

    // Hessian H = Aw^T Aw + LAM * I
    const H: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += Aw[k][i] * Aw[k][j];
        }
        if (i === j) sum += LAM;
        H[i][j] = sum;
      }
    }

    // Target vector y = W * T'
    const yTarget = [W[0] * residualT.protein, W[1] * residualT.carbs, W[2] * residualT.fat];

    // Linear term b = Aw^T yTarget + LAM * g0
    const b = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += Aw[k][i] * yTarget[k];
      }
      sum += LAM * g0[i];
      b[i] = sum;
    }

    // Active-Set BVLS algorithm
    const x = new Array(n);
    const state = new Array(n).fill(0); // 0 = free, -1 = at lb, 1 = at ub

    for (let i = 0; i < n; i++) {
      x[i] = Math.max(lb[i], Math.min(ub[i], g0[i]));
      if (x[i] <= lb[i] + 1e-9) {
        state[i] = -1;
        x[i] = lb[i];
      } else if (x[i] >= ub[i] - 1e-9) {
        state[i] = 1;
        x[i] = ub[i];
      } else {
        state[i] = 0;
      }
    }

    const maxIterations = 100;
    for (let iter = 0; iter < maxIterations; iter++) {
      const free: number[] = [];
      const atLb: number[] = [];
      const atUb: number[] = [];

      for (let i = 0; i < n; i++) {
        if (state[i] === 0) free.push(i);
        else if (state[i] === -1) atLb.push(i);
        else atUb.push(i);
      }

      if (free.length > 0) {
        const m = free.length;
        const Hff: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
        const bff = new Array(m);

        for (let r = 0; r < m; r++) {
          const fi = free[r];
          bff[r] = b[fi];
          for (const bi of atLb) {
            bff[r] -= H[fi][bi] * lb[bi];
          }
          for (const bi of atUb) {
            bff[r] -= H[fi][bi] * ub[bi];
          }
          for (let c = 0; c < m; c++) {
            Hff[r][c] = H[fi][free[c]];
          }
        }

        const pFree = solveLinearSystem(Hff, bff);

        let alpha = 1.0;
        let blockingIdx = -1;
        let blockingState = 0;

        for (let r = 0; r < m; r++) {
          const fi = free[r];
          const d = pFree[r] - x[fi];
          if (d < -1e-12 && pFree[r] < lb[fi]) {
            const a = (lb[fi] - x[fi]) / d;
            if (a < alpha) {
              alpha = a;
              blockingIdx = fi;
              blockingState = -1;
            }
          } else if (d > 1e-12 && pFree[r] > ub[fi]) {
            const a = (ub[fi] - x[fi]) / d;
            if (a < alpha) {
              alpha = a;
              blockingIdx = fi;
              blockingState = 1;
            }
          }
        }

        if (blockingIdx !== -1) {
          for (let r = 0; r < m; r++) {
            const fi = free[r];
            x[fi] += alpha * (pFree[r] - x[fi]);
          }
          state[blockingIdx] = blockingState;
          x[blockingIdx] = blockingState === -1 ? lb[blockingIdx] : ub[blockingIdx];
          continue;
        } else {
          for (let r = 0; r < m; r++) {
            x[free[r]] = pFree[r];
          }
        }
      }

      // Compute gradient: grad = H * x - b
      const grad = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += H[i][j] * x[j];
        }
        grad[i] = sum - b[i];
      }

      let bestViolation = 0;
      let bestI = -1;

      for (const i of atLb) {
        if (grad[i] < -1e-9 && -grad[i] > bestViolation) {
          bestViolation = -grad[i];
          bestI = i;
        }
      }

      for (const i of atUb) {
        if (grad[i] > 1e-9 && grad[i] > bestViolation) {
          bestViolation = grad[i];
          bestI = i;
        }
      }

      if (bestI === -1) {
        // Optimal
        break;
      }

      state[bestI] = 0;
    }

    // Round according to roundTo
    autoGrams = x.map((val, idx) => {
      const roundedVal = Math.round(val / roundTo) * roundTo;
      return Math.max(lb[idx], Math.min(ub[idx], roundedVal));
    });
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
        protein: Number(p.toFixed(2)),
        carbs: Number(c.toFixed(2)),
        fat: Number(fat.toFixed(2)),
      },
      isFixed: false,
    });
  }

  // Add zero-calorie items
  items.push(...zeroCalItems);

  // Preserve original food order from input
  items.sort((a, b) => {
    const idxA = foods.findIndex((f) => f.id === a.foodId);
    const idxB = foods.findIndex((f) => f.id === b.foodId);
    return idxA - idxB;
  });

  const achieved: Macros = {
    protein: Number(totalAchievedP.toFixed(2)),
    carbs: Number(totalAchievedC.toFixed(2)),
    fat: Number(totalAchievedF.toFixed(2)),
  };

  const delta: Macros = {
    protein: Number((achieved.protein - target.protein).toFixed(2)),
    carbs: Number((achieved.carbs - target.carbs).toFixed(2)),
    fat: Number((achieved.fat - target.fat).toFixed(2)),
  };

  const kcal = kcalFromMacros(achieved);

  // Status classification
  // exact: every macro within max(1g, 2%) of target
  // close: every macro within max(2.5g, 10% of target)
  // infeasible: otherwise
  let isExact = true;
  let isClose = true;

  const macroKeys = ["protein", "carbs", "fat"] as const;
  for (const k of macroKeys) {
    const err = Math.abs(delta[k]);
    const tolExact = Math.max(1.0, 0.02 * target[k]);
    const tolClose = Math.max(2.5, 0.1 * target[k]);

    if (err > tolExact) isExact = false;
    if (err > tolClose) isClose = false;
  }

  const status: "exact" | "close" | "infeasible" = isExact ? "exact" : isClose ? "close" : "infeasible";

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

export { solveMeal as solve };
