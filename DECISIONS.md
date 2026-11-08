# Architecture Decision Log

## ADR-001: Pure Framework-Free Solver
- **Context:** The solver determines grams per food to hit macro targets accurately. It must run in <5ms client-side for immediate responsive UX and server-side for authoritative confirmation.
- **Decision:** The solver (`/lib/solver`) has zero dependencies on React, Next.js, or Supabase. It is implemented in pure TypeScript.

## ADR-002: Energy (Calories) Always Derived from Macros
- **Context:** Food nutrition labels often have minor inconsistencies between reported kcal and 4P+4C+9F.
- **Decision:** Caloric totals are deterministically computed as `4 * protein + 4 * carbs + 9 * fat` (Atwater factors) to prevent UI discrepancies between macros and calories.

## ADR-003: Row Level Security on Every Table
- **Context:** Multi-tenant user privacy is critical for personal nutrition data.
- **Decision:** Every table enforces and forces RLS (`alter table ... force row level security`). `meal_items` check ensures the user owns both the item row and the parent `meals` row.

## ADR-004: Food Snapshots in Meal Items
- **Context:** Future updates to global food database entries or edits to custom foods must not rewrite historical meal logs.
- **Decision:** `meal_items` store snapshots of the food's per-100g macros (`protein_100`, `carbs_100`, `fat_100`) and name at log time.

## ADR-005: Absolute Gram Error Formulation with Active-Set BVLS
- **Context:** Relative error scaling caused small/zero targets (e.g. 0g fat) to distort portion sizes and cut protein sources unnaturally.
- **Decision:** The solver minimizes weighted squared error in absolute macro grams with protein weighted 2x (`W = (2.0, 1.0, 1.0)`) and portion prior regularization (`λ = 1e-4`). Solved via an exact active-set bounded variable least squares (BVLS) method in pure TypeScript, achieving 0.00 g worst excess error across all 500 calibration cases against the independent SciPy reference solver (`reference_solver.py`).

## ADR-006: Status Tolerance Bands for Zero or Low Targets
- **Context:** When a target component is 0g or very small, a pure percentage threshold (`10%`) would evaluate to 0g tolerance, causing realistic foods (e.g., chicken breast containing 1.2% fat) to fail status classification even when near-optimal.
- **Decision:** Status classification uses `exact = max(1.0g, 0.02 * target)` and `close = max(2.5g, 0.10 * target)`. This allows near-zero residual fat (e.g. 2.2g from chicken in a 0g fat target meal) to be classified as "close" rather than "infeasible".

## ADR-007: USDA API Key Transmission via Header
- **Context:** Passing API keys in query strings poses leak risks in web server logs, proxies, and error messages.
- **Decision:** Per ARCHITECTURE.md §12.1, the USDA API key is loaded server-side only via `lib/server/env.ts` (validated with Zod) and transmitted using the `X-Api-Key` HTTP header. It is never logged, never returned to the client, and excluded from URLs.
