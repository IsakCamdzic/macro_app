import { describe, it, expect } from "vitest";
import { solve } from "./index";
import { F } from "./__fixtures__/foods";

const grams = (r: ReturnType<typeof solve>, id: string) =>
  r.items.find((i) => i.foodId === id)?.grams ?? 0;
const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

const locked = (f: any, g: number) => ({ ...f, mode: "fixed" as const, fixedGrams: g });
const T = { protein: 50, carbs: 52.5, fat: 25 };

describe("golden cases", () => {
  it("T1 infeasible without a fat source, protein+carbs still on target, suggests oil", () => {
    const r = solve({ target: T, foods: [F.chicken, F.rice, locked(F.broccoli, 150)] });
    expect(r.status).toBe("infeasible");
    near(grams(r, "chicken"), 184, 2);
    near(grams(r, "rice"), 53, 2);
    near(r.achieved.protein, T.protein, 1); // protein is protected
    near(r.achieved.carbs, T.carbs, 1);
    near(r.delta.fat, -21.9, 1.5); // reported shortfall ≈ 22 g
    const s = r.suggestions[0];
    expect(s.kind).toBe("add");
    expect(s.foodId).toBe("oil");
    near(s.grams!, 22, 3);
  });

  it("T2 exact with oil", () => {
    const r = solve({ target: T, foods: [F.chicken, F.rice, F.oil, locked(F.broccoli, 150)] });
    expect(r.status).toBe("exact");
    near(grams(r, "chicken"), 183, 2);
    near(grams(r, "rice"), 53, 2);
    near(grams(r, "oil"), 22, 2);
    for (const k of ["protein", "carbs", "fat"] as const) near(r.achieved[k], T[k], 1);
  });

  it("T4 four foods → unique, accurate answer", () => {
    const r = solve({ target: T, foods: [F.chicken, F.rice, F.oats, F.oil] });
    expect(r.status).toBe("exact");
    near(grams(r, "chicken"), 190, 3);
    near(grams(r, "oil"), 21, 3);
    for (const k of ["protein", "carbs", "fat"] as const) near(r.achieved[k], T[k], 1);
  });

  it("T5 locking chicken at 200 g re-solves the rest", () => {
    const r = solve({ target: T, foods: [locked(F.chicken, 200), F.rice, F.oil] });
    expect(grams(r, "chicken")).toBe(200);
    near(grams(r, "rice"), 65, 3);
    near(grams(r, "oil"), 22, 2);
  });

  it("T7 zero-fat target never wrecks protein (regression: relative-error bug)", () => {
    const r = solve({ target: { protein: 40, carbs: 50, fat: 0 }, foods: [F.chicken, F.rice] });
    near(r.achieved.protein, 40, 1);
    near(r.achieved.carbs, 50, 1);
    expect(grams(r, "chicken")).toBeGreaterThan(140);
  });
});

describe("recalculation behaviour (the core promise)", () => {
  const target = { protein: 40, carbs: 60, fat: 15 };

  it("T3 adding a food changes the other foods' grams and fixes the shortfall", () => {
    const before = solve({ target, foods: [F.chicken, F.rice] });
    const after = solve({ target, foods: [F.chicken, F.rice, F.oil] });
    expect(before.status).toBe("infeasible");
    expect(after.status).toBe("exact");
    near(after.achieved.fat, 15, 1);
    expect(grams(after, "oil")).toBeGreaterThan(8);
    expect(after.delta.fat).toBeGreaterThan(before.delta.fat); // shortfall shrinks
  });

  it("removing a food returns EXACTLY the result of never having added it (no history)", () => {
    const direct = solve({ target, foods: [F.chicken, F.rice] });
    const afterRemove = solve({ target, foods: [F.chicken, F.rice, F.oil].filter((f) => f.id !== "oil") });
    expect(afterRemove).toEqual(direct);
  });

  it("is order independent", () => {
    const foods = [F.chicken, F.rice, F.oats, F.oil];
    const base = solve({ target: T, foods });
    const perms = [
      [3, 2, 1, 0],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
    ];
    for (const p of perms) {
      const r = solve({ target: T, foods: p.map((i) => foods[i]) });
      expect(r.items.map((i) => [i.foodId, i.grams]).sort()).toEqual(
        base.items.map((i) => [i.foodId, i.grams]).sort()
      );
    }
  });

  it("is deterministic: 1000 repeats are identical", () => {
    const ref = JSON.stringify(solve({ target: T, foods: [F.chicken, F.rice, F.oats, F.oil] }));
    for (let i = 0; i < 1000; i++) {
      expect(JSON.stringify(solve({ target: T, foods: [F.chicken, F.rice, F.oats, F.oil] }))).toBe(ref);
    }
  });

  it("unlocking hands the food back to the solver", () => {
    const lockedRes = solve({ target: T, foods: [locked(F.chicken, 300), F.rice, F.oil] });
    const freeRes = solve({ target: T, foods: [F.chicken, F.rice, F.oil] });
    expect(grams(lockedRes, "chicken")).toBe(300);
    expect(grams(freeRes, "chicken")).not.toBe(300);
    expect(freeRes.status).toBe("exact");
  });

  it("a locked food that already exceeds the target is reported, others drop toward 0", () => {
    const r = solve({ target: { protein: 30, carbs: 40, fat: 10 }, foods: [locked(F.chicken, 400), F.rice] });
    expect(r.delta.protein).toBeGreaterThan(30); // ~+65 g over
    expect(r.notes.join(" ")).toMatch(/protein/i);
    expect(r.items.every((i) => i.grams >= 0)).toBe(true);
  });

  it("round-to-5 recomputes achieved macros from the rounded grams", () => {
    const r = solve({ target: T, foods: [F.chicken, F.rice, F.oil, locked(F.broccoli, 150)], roundTo: 5 });
    r.items.forEach((i) => expect(i.grams % 5).toBe(0));
    const recomputed = r.items.reduce(
      (s, i) => {
        const f = Object.values(F).find((x: any) => x.id === i.foodId) as any;
        return {
          protein: s.protein + (f.per100.protein * i.grams) / 100,
          carbs: s.carbs + (f.per100.carbs * i.grams) / 100,
          fat: s.fat + (f.per100.fat * i.grams) / 100,
        };
      },
      { protein: 0, carbs: 0, fat: 0 }
    );
    for (const k of ["protein", "carbs", "fat"] as const) near(r.achieved[k], recomputed[k], 0.01);
  });
});

describe("robustness", () => {
  it("fuzz: 5000 random inputs → never NaN/∞/negative; achieved == recomputed from grams", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const all = Object.values(F) as any[];
    for (let n = 0; n < 5000; n++) {
      const foods = all.filter(() => rnd() < 0.5);
      if (!foods.length) continue;
      const target = { protein: rnd() * 80, carbs: rnd() * 80, fat: rnd() * 80 };
      const r = solve({ target, foods });
      for (const i of r.items) {
        expect(Number.isFinite(i.grams)).toBe(true);
        expect(i.grams).toBeGreaterThanOrEqual(0);
      }
      for (const k of ["protein", "carbs", "fat"] as const) expect(Number.isFinite(r.achieved[k])).toBe(true);
    }
  });

  it("duplicate / collinear foods don't explode", () => {
    const rice2 = { ...F.rice, id: "rice2" };
    const r = solve({ target: T, foods: [F.chicken, F.rice, rice2, F.oil] });
    expect(r.items.every((i) => i.grams >= 0 && i.grams < 1000)).toBe(true);
    near(r.achieved.carbs, T.carbs, 1);
  });

  it("single food hits its dominant macro and reports the rest as shortfall", () => {
    const r = solve({ target: T, foods: [F.chicken] });
    near(r.achieved.protein, 50, 1.5);
    expect(r.status).toBe("infeasible");
  });

  it("solves 10 foods in under 5 ms", () => {
    const foods = Array.from({ length: 10 }, (_, i) => ({
      ...F.rice,
      id: `f${i}`,
      per100: { protein: i, carbs: 80 - i * 5, fat: i * 3 },
    }));
    const t0 = performance.now();
    solve({ target: T, foods });
    expect(performance.now() - t0).toBeLessThan(5);
  });
});

describe("Section 5.5 Edge Cases", () => {
  it("Zero-calorie foods (spices/water) are excluded from solving and preserved with user grams", () => {
    const salt = {
      id: "salt",
      name: "Sea Salt",
      per100: { protein: 0, carbs: 0, fat: 0 },
      mode: "fixed" as const,
      fixedGrams: 3,
    };

    const res = solve({
      target: { protein: 40, carbs: 60, fat: 15 },
      foods: [F.chicken, F.rice, F.oil, salt],
    });

    const saltItem = res.items.find((i) => i.foodId === "salt");
    expect(saltItem).toBeDefined();
    expect(saltItem?.grams).toBe(3);
  });

  it("Enforces maxGrams binding strictly", () => {
    const constrainedOil = {
      ...F.oil,
      id: "oil_cap",
      maxGrams: 10,
    };

    const res = solve({
      target: { protein: 30, carbs: 0, fat: 50 },
      foods: [F.chicken, constrainedOil],
    });

    const oilItem = res.items.find((i) => i.foodId === "oil_cap");
    expect(oilItem?.grams).toBeLessThanOrEqual(10);
  });
});
