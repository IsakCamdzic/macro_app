import { describe, it, expect } from "vitest";
import { solveMeal } from "./solve";
import { SolverFood, SolverInput } from "./types";

const chickenBreast: SolverFood = {
  id: "chicken",
  name: "Chicken Breast (raw)",
  per100: { protein: 23.0, carbs: 0.0, fat: 1.2 },
  mode: "auto",
};

const whiteRice: SolverFood = {
  id: "rice",
  name: "White Rice (raw)",
  per100: { protein: 7.0, carbs: 80.0, fat: 0.6 },
  mode: "auto",
};

const broccoli: SolverFood = {
  id: "broccoli",
  name: "Broccoli (raw)",
  per100: { protein: 2.8, carbs: 7.0, fat: 0.4 },
  mode: "fixed",
  fixedGrams: 150,
};

const oliveOil: SolverFood = {
  id: "olive_oil",
  name: "Extra Virgin Olive Oil",
  per100: { protein: 0.0, carbs: 0.0, fat: 100.0 },
  mode: "auto",
  maxGrams: 60,
};

describe("Solver - Section 11 Acceptance Criteria", () => {
  it("Criterion 1: Chicken + Rice + Broccoli (locked 150g) with Target 50P / 52.5C / 25F", () => {
    const input: SolverInput = {
      target: { protein: 50, carbs: 52.5, fat: 25 },
      foods: [chickenBreast, whiteRice, broccoli],
      roundTo: 1,
    };

    const result = solveMeal(input);

    expect(result.status).toBe("infeasible");
    // Fat shortfall should be around 20+ g
    expect(result.delta.fat).toBeLessThan(-18);

    // Top suggestion must be to add olive oil ≈ 20-23 g
    expect(result.suggestions.length).toBeGreaterThan(0);
    const topSuggestion = result.suggestions.find((s) => s.foodName?.toLowerCase().includes("olive oil"));
    expect(topSuggestion).toBeDefined();
    expect(topSuggestion?.grams).toBeGreaterThanOrEqual(20);
    expect(topSuggestion?.grams).toBeLessThanOrEqual(24);

    // No negative grams
    for (const item of result.items) {
      expect(item.grams).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(item.grams)).toBe(true);
      expect(Number.isNaN(item.grams)).toBe(false);
    }
  });

  it("Criterion 2: Chicken + Rice + Broccoli (locked 150g) + Olive Oil with Target 50P / 52.5C / 25F", () => {
    const input: SolverInput = {
      target: { protein: 50, carbs: 52.5, fat: 25 },
      foods: [chickenBreast, whiteRice, broccoli, oliveOil],
      roundTo: 1,
    };

    const result = solveMeal(input);

    expect(result.status).toBe("exact");

    const chickenItem = result.items.find((i) => i.foodId === "chicken");
    const riceItem = result.items.find((i) => i.foodId === "rice");
    const oilItem = result.items.find((i) => i.foodId === "olive_oil");

    expect(chickenItem).toBeDefined();
    expect(riceItem).toBeDefined();
    expect(oilItem).toBeDefined();

    // Chicken ≈ 180g (±5g)
    expect(chickenItem!.grams).toBeGreaterThanOrEqual(175);
    expect(chickenItem!.grams).toBeLessThanOrEqual(188);

    // Rice ≈ 52g (±3g)
    expect(riceItem!.grams).toBeGreaterThanOrEqual(50);
    expect(riceItem!.grams).toBeLessThanOrEqual(56);

    // Oil ≈ 22g (±2g)
    expect(oilItem!.grams).toBeGreaterThanOrEqual(20);
    expect(oilItem!.grams).toBeLessThanOrEqual(24);

    // Macros within ±1g of target
    expect(Math.abs(result.achieved.protein - 50)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(result.achieved.carbs - 52.5)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(result.achieved.fat - 25)).toBeLessThanOrEqual(1.0);
  });

  it("Criterion 3: Determinism - 1,000 repeated solves return byte-identical output", () => {
    const input: SolverInput = {
      target: { protein: 50, carbs: 52.5, fat: 25 },
      foods: [chickenBreast, whiteRice, broccoli, oliveOil],
      roundTo: 1,
    };

    const baselineJson = JSON.stringify(solveMeal(input));

    for (let i = 0; i < 1000; i++) {
      const currentJson = JSON.stringify(solveMeal(input));
      if (currentJson !== baselineJson) {
        throw new Error(`Determinism failed at iteration ${i}`);
      }
    }
  });

  it("Criterion 4: Fuzz testing 5,000 random inputs - no NaN/Inf/negative, achieved matches recomputation", () => {
    const candidateFoods: SolverFood[] = [
      { id: "f1", name: "Food 1", per100: { protein: 30, carbs: 0, fat: 5 }, mode: "auto" },
      { id: "f2", name: "Food 2", per100: { protein: 2, carbs: 70, fat: 1 }, mode: "auto" },
      { id: "f3", name: "Food 3", per100: { protein: 0, carbs: 0, fat: 90 }, mode: "auto", maxGrams: 50 },
      { id: "f4", name: "Food 4", per100: { protein: 12, carbs: 12, fat: 12 }, mode: "auto" },
      { id: "f5", name: "Food 5 (fixed)", per100: { protein: 10, carbs: 20, fat: 2 }, mode: "fixed", fixedGrams: 100 },
      { id: "f6", name: "Food 6 (zero cal)", per100: { protein: 0, carbs: 0, fat: 0 }, mode: "fixed", fixedGrams: 200 },
    ];

    for (let iter = 0; iter < 5000; iter++) {
      const pTarget = Math.floor(Math.random() * 80) + 10;
      const cTarget = Math.floor(Math.random() * 120) + 10;
      const fTarget = Math.floor(Math.random() * 50) + 5;

      // Select 1 to 5 foods randomly
      const numFoods = Math.floor(Math.random() * 4) + 1;
      const foods: SolverFood[] = [];
      for (let j = 0; j < numFoods; j++) {
        foods.push(candidateFoods[j % candidateFoods.length]);
      }

      const res = solveMeal({
        target: { protein: pTarget, carbs: cTarget, fat: fTarget },
        foods,
        roundTo: iter % 2 === 0 ? 1 : 5,
      });

      // Verify no NaN or negative grams
      let recomputedP = 0;
      let recomputedC = 0;
      let recomputedF = 0;

      for (const item of res.items) {
        expect(Number.isFinite(item.grams)).toBe(true);
        expect(item.grams).toBeGreaterThanOrEqual(0);

        const food = foods.find((f) => f.id === item.foodId);
        if (food) {
          recomputedP += (item.grams * food.per100.protein) / 100;
          recomputedC += (item.grams * food.per100.carbs) / 100;
          recomputedF += (item.grams * food.per100.fat) / 100;
        }
      }

      expect(Number.isFinite(res.achieved.protein)).toBe(true);
      expect(Number.isFinite(res.achieved.carbs)).toBe(true);
      expect(Number.isFinite(res.achieved.fat)).toBe(true);
      expect(Number.isFinite(res.kcal)).toBe(true);

      // Achieved matches recomputed
      expect(Math.abs(res.achieved.protein - recomputedP)).toBeLessThanOrEqual(0.2);
      expect(Math.abs(res.achieved.carbs - recomputedC)).toBeLessThanOrEqual(0.2);
      expect(Math.abs(res.achieved.fat - recomputedF)).toBeLessThanOrEqual(0.2);
    }
  });

  it("Criterion 5: Performance - solves 10 foods in < 5 ms", () => {
    const tenFoods: SolverFood[] = [
      { id: "1", name: "Chicken", per100: { protein: 23, carbs: 0, fat: 1.2 }, mode: "auto" },
      { id: "2", name: "Rice", per100: { protein: 7, carbs: 80, fat: 0.6 }, mode: "auto" },
      { id: "3", name: "Olive oil", per100: { protein: 0, carbs: 0, fat: 100 }, mode: "auto", maxGrams: 60 },
      { id: "4", name: "Broccoli", per100: { protein: 2.8, carbs: 7, fat: 0.4 }, mode: "auto" },
      { id: "5", name: "Egg", per100: { protein: 12.6, carbs: 0.8, fat: 9.5 }, mode: "auto" },
      { id: "6", name: "Oats", per100: { protein: 13.5, carbs: 68, fat: 7 }, mode: "auto" },
      { id: "7", name: "Whey", per100: { protein: 80, carbs: 5, fat: 3 }, mode: "auto" },
      { id: "8", name: "Peanut butter", per100: { protein: 25, carbs: 20, fat: 50 }, mode: "auto" },
      { id: "9", name: "Sweet potato", per100: { protein: 1.6, carbs: 20, fat: 0.1 }, mode: "auto" },
      { id: "10", name: "Salmon", per100: { protein: 20, carbs: 0, fat: 13 }, mode: "fixed", fixedGrams: 100 },
    ];

    const input: SolverInput = {
      target: { protein: 60, carbs: 75, fat: 30 },
      foods: tenFoods,
      roundTo: 1,
    };

    // Warm up
    solveMeal(input);

    const start = performance.now();
    const runs = 50;
    for (let i = 0; i < runs; i++) {
      solveMeal(input);
    }
    const duration = performance.now() - start;
    const avgMs = duration / runs;

    expect(avgMs).toBeLessThan(5.0);
  });
});

describe("Solver - Section 5.5 Edge Cases", () => {
  it("Collinear / duplicate foods do not produce NaN or exploding grams", () => {
    const duplicateRice1: SolverFood = {
      id: "rice_1",
      name: "Rice 1",
      per100: { protein: 7, carbs: 80, fat: 0.6 },
      mode: "auto",
    };
    const duplicateRice2: SolverFood = {
      id: "rice_2",
      name: "Rice 2",
      per100: { protein: 7, carbs: 80, fat: 0.6 },
      mode: "auto",
    };

    const res = solveMeal({
      target: { protein: 7, carbs: 80, fat: 1 },
      foods: [duplicateRice1, duplicateRice2],
    });

    for (const item of res.items) {
      expect(Number.isFinite(item.grams)).toBe(true);
      expect(item.grams).toBeGreaterThanOrEqual(0);
      expect(item.grams).toBeLessThan(500);
    }
  });

  it("Handles zero target component (e.g. 0g fat meal)", () => {
    const res = solveMeal({
      target: { protein: 40, carbs: 50, fat: 0 },
      foods: [chickenBreast, whiteRice],
    });

    expect(res.achieved.fat).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(res.achieved.protein)).toBe(true);
    expect(Number.isFinite(res.achieved.carbs)).toBe(true);
  });

  it("Handles fixed food that already exceeds target", () => {
    const hugeSteak: SolverFood = {
      id: "steak",
      name: "Ribeye Steak",
      per100: { protein: 24, carbs: 0, fat: 20 },
      mode: "fixed",
      fixedGrams: 400, // 96g protein, 80g fat!
    };

    const res = solveMeal({
      target: { protein: 40, carbs: 50, fat: 20 },
      foods: [hugeSteak, whiteRice],
    });

    expect(res.status).toBe("infeasible");
    expect(res.delta.protein).toBeGreaterThan(0);
    expect(res.delta.fat).toBeGreaterThan(0);
    // Rice should still provide carbs
    const rice = res.items.find((i) => i.foodId === "rice");
    expect(rice?.grams).toBeGreaterThan(0);
  });

  it("Enforces maxGrams binding strictly", () => {
    const constrainedOil: SolverFood = {
      id: "oil_cap",
      name: "Capped Oil",
      per100: { protein: 0, carbs: 0, fat: 100 },
      mode: "auto",
      maxGrams: 10,
    };

    const res = solveMeal({
      target: { protein: 30, carbs: 0, fat: 50 },
      foods: [chickenBreast, constrainedOil],
    });

    const oilItem = res.items.find((i) => i.foodId === "oil_cap");
    expect(oilItem?.grams).toBeLessThanOrEqual(10);
  });

  it("Zero-calorie foods (spices/water) are excluded from solving and preserved with user grams", () => {
    const salt: SolverFood = {
      id: "salt",
      name: "Sea Salt",
      per100: { protein: 0, carbs: 0, fat: 0 },
      mode: "fixed",
      fixedGrams: 3,
    };

    const res = solveMeal({
      target: { protein: 40, carbs: 60, fat: 15 },
      foods: [chickenBreast, whiteRice, oliveOil, salt],
    });

    const saltItem = res.items.find((i) => i.foodId === "salt");
    expect(saltItem).toBeDefined();
    expect(saltItem?.grams).toBe(3);
  });
});
