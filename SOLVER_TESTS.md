# MacroMeal — Solver Tests, Calibration & USDA Data

> Audience: the build agent (and you, Isak, for running it).
> Goal: prove that **adding, removing or locking a food instantly recalculates every other food's grams so the meal lands on its macros**, and keep proving it every time the code changes.
> The golden numbers below were computed with an independent implementation (`reference_solver.py`, SciPy bounded least squares), not by the app's own solver.

---

## 0. Behaviour being tested

1. Add a food → all auto foods re-solve; grams of the others change.
2. Remove a food → all auto foods re-solve; result equals what you'd get had the food never been added (**no history dependence**).
3. Lock a food at your own grams → the others solve around it.
4. Same input always → same output, in any food order.
5. If the macros can't be hit with the chosen foods, the app says so, reports the exact shortfall, and suggests a food that fixes it. **Protein and carbs still land on target; the unreachable macro takes the miss.**
6. Output is never negative, NaN or Infinity.

> Spec correction found while building this test plan: the first draft of the solver used *relative* error, which broke zero-fat targets (it cut chicken to ~5 g for a 40 g protein target). The spec now uses absolute-gram error with protein weighted ×2. Test T7 below exists to make sure that bug never returns.

---

## 1. Test fixtures (fixed values — tests must not depend on live USDA data)

Per 100 g. Put these in `lib/solver/__fixtures__/foods.ts`.

| id | protein | carbs | fat | default portion | max |
|---|---|---|---|---|---|
| chicken (raw breast) | 23 | 0 | 1.2 | 150 g | 1000 g |
| rice (white, raw) | 7 | 80 | 0.6 | 100 g | 1000 g |
| broccoli | 2.8 | 7 | 0.4 | 150 g | 1000 g |
| oil (olive) | 0 | 0 | 100 | 10 g | 60 g |
| oats | 13 | 68 | 7 | 60 g | 1000 g |
| pb (peanut butter) | 25 | 20 | 50 | 15 g | 100 g |

Solver constants under test: weights **P 2 / C 1 / F 1**, **λ = 1e-4**, rounding to 1 g.

---

## 2. Golden cases (computed by `reference_solver.py`)

Target is P / C / F in grams. "Locked" means the user fixed those grams.

| # | Target | Foods | Locked | Expected grams | Achieved P / C / F | Status |
|---|---|---|---|---|---|---|
| T1 | 50 / 52.5 / 25 | chicken, rice, broccoli | broccoli 150 | chicken 184, rice 53 | 50.2 / 52.9 / **3.1** | `infeasible` (fat ≈ 22 g short) |
| T2 | 50 / 52.5 / 25 | chicken, rice, broccoli, oil | broccoli 150 | chicken 183, rice 53, oil 22 | 50.0 / 52.9 / 25.1 | `exact` |
| T3a | 40 / 60 / 15 | chicken, rice | — | chicken 152, rice 75 | 40.2 / 60.0 / 2.3 | `infeasible` |
| T3b | 40 / 60 / 15 | chicken, rice, **+ oil** | — | chicken 151, rice 75, oil 13 | 40.0 / 60.0 / 15.3 | `exact` |
| T4 | 50 / 52.5 / 25 | chicken, rice, oats, oil (4 foods, underdetermined) | — | chicken 190, rice 44, oats 25, oil 21 | 50.0 / 52.2 / 25.3 | `exact` |
| T5 | 50 / 52.5 / 25 | chicken, rice, oil | chicken 200 | rice 65, oil 22 (chicken 200) | 50.6 / 52.0 / 24.8 | `exact` |
| T7 | 40 / 50 / **0** | chicken, rice | — | chicken 155, rice 62 | 40.0 / 49.6 / 2.2 | `close` (fat can't be 0 with chicken) |

Tolerance when comparing to the table: **±2 g per food**, and each achieved macro within **±1 g** of the table value. (Different but equally good solvers may differ by a gram or two because of rounding; macro accuracy is what matters.)

Status rule (from `ARCHITECTURE.md` §5.3): `exact` = every macro within max(1 g, 2 %); `close` = within 10 %; otherwise `infeasible`. Check T7 against that rule when you implement it — if fat is "2.2 g over a 0 g target", define the 10 % band on `max(target, 5 g)` so a zero target can ever be `close`; record the decision in `DECISIONS.md`.

---

## 3. The tests (Vitest)

`lib/solver/solver.test.ts`. Assumes `solve(input): SolverResult` from `ARCHITECTURE.md` §5.1, and `F` = the fixture foods above.

```ts
import { describe, it, expect } from "vitest";
import { solve } from "./index";
import { F } from "./__fixtures__/foods"; // F.chicken, F.rice, F.broccoli, F.oil, F.oats, F.pb

const grams = (r: ReturnType<typeof solve>, id: string) =>
  r.items.find(i => i.foodId === id)?.grams ?? 0;
const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

const locked = (f: any, g: number) => ({ ...f, mode: "fixed" as const, fixedGrams: g });
const T = { protein: 50, carbs: 52.5, fat: 25 };

describe("golden cases", () => {
  it("T1 infeasible without a fat source, protein+carbs still on target, suggests oil", () => {
    const r = solve({ target: T, foods: [F.chicken, F.rice, locked(F.broccoli, 150)] });
    expect(r.status).toBe("infeasible");
    near(grams(r, "chicken"), 184, 2);
    near(grams(r, "rice"), 53, 2);
    near(r.achieved.protein, T.protein, 1);       // protein is protected
    near(r.achieved.carbs, T.carbs, 1);
    near(r.delta.fat, -21.9, 1.5);                // reported shortfall ≈ 22 g
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
    // adding oil must reduce how much fat has to come from elsewhere, so chicken shifts slightly
    expect(grams(after, "oil")).toBeGreaterThan(8);
    expect(after.delta.fat).toBeGreaterThan(before.delta.fat);   // shortfall shrinks
  });

  it("removing a food returns EXACTLY the result of never having added it (no history)", () => {
    const direct = solve({ target, foods: [F.chicken, F.rice] });
    const afterRemove = solve({ target, foods: [F.chicken, F.rice, F.oil].filter(f => f.id !== "oil") });
    expect(afterRemove).toEqual(direct);
  });

  it("is order independent", () => {
    const foods = [F.chicken, F.rice, F.oats, F.oil];
    const base = solve({ target: T, foods });
    const perms = [[3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]];
    for (const p of perms) {
      const r = solve({ target: T, foods: p.map(i => foods[i]) });
      expect(r.items.map(i => [i.foodId, i.grams]).sort()).toEqual(
        base.items.map(i => [i.foodId, i.grams]).sort());
    }
  });

  it("is deterministic: 1000 repeats are identical", () => {
    const ref = JSON.stringify(solve({ target: T, foods: [F.chicken, F.rice, F.oats, F.oil] }));
    for (let i = 0; i < 1000; i++)
      expect(JSON.stringify(solve({ target: T, foods: [F.chicken, F.rice, F.oats, F.oil] }))).toBe(ref);
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
    expect(r.delta.protein).toBeGreaterThan(30);   // ~+65 g over
    expect(r.notes.join(" ")).toMatch(/protein/i);
    expect(r.items.every(i => i.grams >= 0)).toBe(true);
  });

  it("round-to-5 recomputes achieved macros from the rounded grams", () => {
    const r = solve({ target: T, foods: [F.chicken, F.rice, F.oil, locked(F.broccoli, 150)], roundTo: 5 });
    r.items.forEach(i => expect(i.grams % 5).toBe(0));
    const recomputed = r.items.reduce((s, i) => {
      const f = Object.values(F).find((x: any) => x.id === i.foodId) as any;
      return { protein: s.protein + f.per100.protein * i.grams / 100,
               carbs:   s.carbs   + f.per100.carbs   * i.grams / 100,
               fat:     s.fat     + f.per100.fat     * i.grams / 100 };
    }, { protein: 0, carbs: 0, fat: 0 });
    for (const k of ["protein", "carbs", "fat"] as const) near(r.achieved[k], recomputed[k], 0.01);
  });
});

describe("robustness", () => {
  it("fuzz: 5000 random inputs → never NaN/∞/negative; achieved == recomputed from grams", () => {
    let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
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
    expect(r.items.every(i => i.grams >= 0 && i.grams < 1000)).toBe(true);
    near(r.achieved.carbs, T.carbs, 1);
  });

  it("single food hits its dominant macro and reports the rest as shortfall", () => {
    const r = solve({ target: T, foods: [F.chicken] });
    near(r.achieved.protein, 50, 1.5);
    expect(r.status).toBe("infeasible");
  });

  it("solves 10 foods in under 5 ms", () => {
    const foods = Array.from({ length: 10 }, (_, i) => ({ ...F.rice, id: `f${i}`, per100: { protein: i, carbs: 80 - i * 5, fat: i * 3 } }));
    const t0 = performance.now(); solve({ target: T, foods }); expect(performance.now() - t0).toBeLessThan(5);
  });
});
```

---

## 4. Calibration against the independent reference ("recalibrate")

The golden table checks a handful of cases. **Calibration** checks the app's solver against the independent reference on hundreds of random cases, so a subtle regression in the TypeScript solver is caught immediately.

1. Install once: `pip install numpy scipy`.
2. Generate cases (re-run whenever fixtures or weights change):
   ```
   python reference_solver.py --gen 500 lib/solver/__fixtures__/reference-cases.json
   ```
   Commit the JSON. It contains the foods, weights, λ, and for each case: target, foods, locked foods, reference grams and reference achieved macros.
3. Add this test (`lib/solver/calibration.test.ts`):

```ts
import { it, expect } from "vitest";
import { solve } from "./index";
import data from "./__fixtures__/reference-cases.json";

const toFood = (id: string, locked?: number) => {
  const f = (data.foods as any)[id];
  return { id, name: id, per100: { protein: f.p, carbs: f.c, fat: f.f },
           defaultGrams: f.g0, maxGrams: f.mx,
           mode: locked !== undefined ? "fixed" as const : "auto" as const,
           ...(locked !== undefined ? { fixedGrams: locked } : {}) };
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
      expect(mine).toBeLessThanOrEqual(ref + 1.0);     // never more than 1 g worse than reference
    });
  }
  console.log("worst excess error vs reference (g):", worst.toFixed(2));
});
```

**Pass criteria:** zero failures; "worst excess error" ≤ 1.0 g. If it fails, fix the solver (not the tolerance). If the weights or λ are changed on purpose, change them in **both** `reference_solver.py` and the TS solver, regenerate the JSON, and note it in `DECISIONS.md`.

---

## 5. Run order & CI

```
npm run test:solver        # vitest run lib/solver
npm run test:calibration   # vitest run lib/solver/calibration.test.ts
```
Both run on every PR; a red solver test blocks merge. Re-run calibration whenever `solve.ts`, the fixtures, the weights or λ change.

Manual 2-minute check in the running app once the meal builder exists (matches T1 → T2):
1. Set the meal target to 50 / 52.5 / 25.
2. Add chicken, rice, broccoli → lock broccoli at 150 g. Expect: chicken ≈ 184 g, rice ≈ 53 g, banner "fat is ~22 g short", chip "Add ~22 g olive oil".
3. Tap the chip. Expect chicken → 183 g, rice 53 g, oil 22 g, status "On target", numbers animate.
4. Remove the oil. Expect the exact numbers from step 2 again.

---

## 6. USDA FoodData Central — where to get the data and how to store it

All of these were checked against the FoodData Central site:

| What | Link |
|---|---|
| Home / food search | https://fdc.nal.usda.gov/ |
| **Data downloads** (bulk CSV/JSON) | https://fdc.nal.usda.gov/download-datasets |
| **Free API key** (arrives by email) | https://fdc.nal.usda.gov/api-key-signup |
| API guide | https://fdc.nal.usda.gov/api-guide |
| Data type documentation | https://fdc.nal.usda.gov/data-documentation |

Facts that matter for the app:
- The data is public domain (CC0). No permission needed; USDA asks that you credit FoodData Central as the source — put "Nutrition data: USDA FoodData Central" in the app's About page.
- API default limit is 1,000 requests/hour per IP; the shared `DEMO_KEY` is only 30/hour and 50/day, so get your own key. **Never commit the key** — USDA deactivates keys found in public repos. Keep it as a server-only env var (`USDA_API_KEY`).
- Each API food has `fdcId`, `description`, `dataType` and `foodNutrients`.

### Recommended storage strategy (hybrid)

1. **Bulk-import the generic data once.** From the Data Downloads page, download the **Foundation Foods** and **SR Legacy** datasets (CSV). These are the generic ingredients (chicken, rice, broccoli, oil…) and are exactly what the solver needs. Import them into the `foods` table as global rows (`owner_id null`, `source 'usda'`, `external_id = fdc_id`).
   - From the CSVs you need: `food.csv` (fdc_id, description, data_type), `food_nutrient.csv` (fdc_id, nutrient_id, amount) and `nutrient.csv`. Verify the nutrient ids in the downloaded `nutrient.csv` before trusting them; they should be **1003 = Protein, 1004 = Total lipid (fat), 1005 = Carbohydrate, by difference** (energy is 1008). Amounts are **per 100 g**.
   - Write the importer as `scripts/import-usda.ts` (run locally, uses the service role key, never deployed). Skip foods missing any of the three macros; skip rows where protein + carbs + fat > 100.5 g/100 g (the `foods` check constraint); set `state` = raw/cooked by parsing the description ("raw", "cooked", "boiled"…) and `na` otherwise.
   - Add the first-pass **seed list** of ~100 staples (chicken breast raw/cooked, white rice raw/cooked, oats, eggs, olive oil, etc.) as favourites-by-default so search feels instant.
2. **Use the live API only for Branded foods** (packaged products), through the server-side search proxy in `ARCHITECTURE.md` §7, caching each result into `foods` on first use.
3. **Validate on import**, then spot-check 10 foods by hand against the FDC website. Do this check before launch; the solver can only be as accurate as the numbers it is fed.

Accuracy notes the UI must respect: USDA values are for the stated state — **100 g raw rice is not 100 g cooked rice**. Show RAW / COOKED on every food, and never silently substitute one for the other.

---

## 7. Definition of done for the solver

- All tests in §3 pass; calibration (§4) passes with worst excess error ≤ 1.0 g.
- The manual check in §5 gives the stated numbers.
- Fixtures in §1 are cross-checked against the USDA site once, and the importer in §6 is run and spot-checked.
- `DECISIONS.md` records any deviation (status band for zero targets, weights, λ).
