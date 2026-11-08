import { Macros, SolverFood, SolverInput, Suggestion } from "./types";
import { CURATED_STAPLES } from "./staples";
import { solveMeal } from "./solve";

export function generateSuggestionsAndNotes(
  input: SolverInput,
  achieved: Macros,
  delta: Macros,
  status: "exact" | "close" | "infeasible"
): { suggestions: Suggestion[]; notes: string[] } {
  const suggestions: Suggestion[] = [];
  const notes: string[] = [];

  const { target, foods } = input;

  // Explanations of food roles
  const dominantRoles: string[] = [];
  for (const food of foods) {
    const p = food.per100.protein;
    const c = food.per100.carbs;
    const f = food.per100.fat;

    if (p > 15 && p > c && p > f) {
      dominantRoles.push(`${food.name} sets your protein`);
    } else if (c > 30 && c > p && c > f) {
      dominantRoles.push(`${food.name} sets your carbs`);
    } else if (f > 30 && f > p && f > c) {
      dominantRoles.push(`${food.name} sets your fat`);
    }
  }

  // Check if status is exact
  if (status === "exact") {
    if (dominantRoles.length > 0) {
      notes.push(dominantRoles.slice(0, 3).join(". ") + ".");
    }
    notes.push("All macros are balanced within target threshold.");
    return { suggestions, notes };
  }

  // Calculate relative deltas
  const relP = delta.protein / Math.max(target.protein, 1);
  const relC = delta.carbs / Math.max(target.carbs, 1);
  const relF = delta.fat / Math.max(target.fat, 1);

  // Find worst macro
  const macroDeltas = [
    { macro: "protein", name: "protein", val: delta.protein, rel: relP, absVal: Math.abs(delta.protein) },
    { macro: "carbs", name: "carbohydrates", val: delta.carbs, rel: relC, absVal: Math.abs(delta.carbs) },
    { macro: "fat", name: "fat", val: delta.fat, rel: relF, absVal: Math.abs(delta.fat) },
  ];

  // Sort by worst relative deviation
  macroDeltas.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
  const worst = macroDeltas[0];

  // Notes on the situation
  if (worst.val < -1) {
    const shortfallG = Math.abs(worst.val);
    const existingNames = foods.map((f) => f.name.toLowerCase());
    const hasMacroSource = foods.some((f) => {
      if (worst.macro === "fat") return f.per100.fat >= 20;
      if (worst.macro === "carbs") return f.per100.carbs >= 30;
      if (worst.macro === "protein") return f.per100.protein >= 15;
      return false;
    });

    if (!hasMacroSource) {
      notes.push(`${dominantRoles.join(". ")}. Fat is ${shortfallG}g short — no food in this meal contains enough fat.`);
    } else {
      notes.push(`${worst.name.charAt(0).toUpperCase() + worst.name.slice(1)} is ${shortfallG}g short of the target.`);
    }

    // Shortfall: find candidates from CURATED_STAPLES
    const candidates = CURATED_STAPLES.filter((staple) => {
      // Don't suggest a food already in the meal
      if (existingNames.some((n) => staple.name.toLowerCase().includes(n) || n.includes(staple.name.toLowerCase()))) {
        return false;
      }
      if (worst.macro === "fat") return staple.per100.fat >= 40;
      if (worst.macro === "carbs") return staple.per100.carbs >= 40;
      if (worst.macro === "protein") return staple.per100.protein >= 20;
      return false;
    });

    // Baseline error
    const baseError = relP * relP + relC * relC + relF * relF;

    for (const cand of candidates.slice(0, 3)) {
      // Try adding this candidate to the solver
      const testFoods: SolverFood[] = [...foods, cand];
      const testResult = solveMeal({
        target,
        foods: testFoods,
        roundTo: input.roundTo ?? 1,
      });

      const candItem = testResult.items.find((item) => item.foodId === cand.id);
      const candGrams = candItem ? candItem.grams : 0;

      const newRelP = testResult.delta.protein / Math.max(target.protein, 1);
      const newRelC = testResult.delta.carbs / Math.max(target.carbs, 1);
      const newRelF = testResult.delta.fat / Math.max(target.fat, 1);
      const newError = newRelP * newRelP + newRelC * newRelC + newRelF * newRelF;

      if (candGrams > 0 && (testResult.status === "exact" || newError < baseError * 0.75)) {
        suggestions.push({
          kind: "add",
          foodId: cand.id,
          foodName: cand.name,
          grams: candGrams,
          resultingStatus: testResult.status,
          message: `Add ~${candGrams}g ${cand.name} to balance ${worst.name}.`,
        });
      }
    }
  } else if (worst.val > 1) {
    // Overshoot
    const overshootG = worst.val;
    // Find food contributing most to this overshoot
    let highestContributor: SolverFood | null = null;
    let maxGramsOfMacro = 0;

    for (const f of foods) {
      const g = f.fixedGrams ?? f.defaultGrams ?? 100;
      let macroG = 0;
      if (worst.macro === "fat") macroG = (g * f.per100.fat) / 100;
      if (worst.macro === "carbs") macroG = (g * f.per100.carbs) / 100;
      if (worst.macro === "protein") macroG = (g * f.per100.protein) / 100;

      if (macroG > maxGramsOfMacro) {
        maxGramsOfMacro = macroG;
        highestContributor = f;
      }
    }

    if (highestContributor) {
      notes.push(`${highestContributor.name} pushes ${worst.name} over target by ${overshootG}g.`);
      suggestions.push({
        kind: "reduce",
        foodId: highestContributor.id,
        foodName: highestContributor.name,
        resultingStatus: "close",
        message: `Reduce portion of ${highestContributor.name} to control ${worst.name}.`,
      });
    }
  }

  if (notes.length === 0) {
    notes.push("Adjust food quantities or add an ingredient to hit your exact macro targets.");
  }

  return { suggestions, notes };
}
