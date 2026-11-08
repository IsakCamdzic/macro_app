import { describe, it, expect } from "vitest";
import { computeTargetPlan, kcalFromMacros } from "./index";

describe("Targets computation", () => {
  it("calculates daily and per-meal targets correctly for standard 2000 kcal 30/40/30 4 meals", () => {
    const plan = computeTargetPlan({
      kcalTarget: 2000,
      splitProteinPct: 30,
      splitCarbsPct: 40,
      splitFatPct: 30,
      mealsPerDay: 4,
    });

    // 2000 * 0.30 / 4 = 150g protein
    // 2000 * 0.40 / 4 = 200g carbs
    // 2000 * 0.30 / 9 = 66.7g fat
    expect(plan.daily.protein).toBe(150);
    expect(plan.daily.carbs).toBe(200);
    expect(plan.daily.fat).toBe(66.7);

    // Per meal (4 meals)
    expect(plan.perMeal.protein).toBe(37.5);
    expect(plan.perMeal.carbs).toBe(50);
    expect(plan.perMeal.fat).toBe(16.7);

    expect(plan.daily.kcal).toBe(kcalFromMacros(150, 200, 66.7));
  });

  it("rejects splits that do not sum to 100", () => {
    expect(() =>
      computeTargetPlan({
        kcalTarget: 2000,
        splitProteinPct: 30,
        splitCarbsPct: 30,
        splitFatPct: 30,
        mealsPerDay: 3,
      })
    ).toThrow();
  });

  it("rejects out-of-range calories or mealsPerDay", () => {
    expect(() =>
      computeTargetPlan({
        kcalTarget: 700,
        splitProteinPct: 30,
        splitCarbsPct: 40,
        splitFatPct: 30,
        mealsPerDay: 3,
      })
    ).toThrow();

    expect(() =>
      computeTargetPlan({
        kcalTarget: 2000,
        splitProteinPct: 30,
        splitCarbsPct: 40,
        splitFatPct: 30,
        mealsPerDay: 0,
      })
    ).toThrow();
  });
});
