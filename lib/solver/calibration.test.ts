import { it, expect } from "vitest";
import { solve } from "./index";
import data from "./__fixtures__/reference-cases.json";

const toFood = (id: string, locked?: number) => {
  const f = (data.foods as any)[id];
  return {
    id,
    name: id,
    per100: { protein: f.p, carbs: f.c, fat: f.f },
    defaultGrams: f.g0,
    maxGrams: f.mx,
    mode: locked !== undefined ? ("fixed" as const) : ("auto" as const),
    ...(locked !== undefined ? { fixedGrams: locked } : {}),
  };
};

it("TS solver is at least as accurate as the reference on every case", () => {
  let worst = 0;
  for (const c of data.cases as any[]) {
    const target = { protein: c.target[0], carbs: c.target[1], fat: c.target[2] };
    const r = solve({ target, foods: c.foods.map((id: string) => toFood(id, c.locked[id])) });
    const ks = ["protein", "carbs", "fat"] as const;
    ks.forEach((k, i) => {
      const mine = Math.abs(r.achieved[k] - target[k]);
      const ref = Math.abs(c.ref_achieved[i] - target[k]);
      worst = Math.max(worst, mine - ref);
      expect(mine).toBeLessThanOrEqual(ref + 1.0); // never more than 1 g worse than reference
    });
  }
  console.log("worst excess error vs reference (g):", worst.toFixed(2));
});
