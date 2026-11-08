# Architecture Decision Log

## ADR-001: Pure Framework-Free Solver
- **Context:** The solver determines grams per food to hit macro targets accurately. It must run in <5ms client-side for immediate responsive UX and server-side for authoritative confirmation.
- **Decision:** The solver (`/lib/solver`) has zero dependencies on React, Next.js, or Supabase. It uses a bounded regularized relative least-squares formulation solved via Lawson-Hanson active-set NNLS with bound shifting.

## ADR-002: Energy (Calories) Always Derived from Macros
- **Context:** Food nutrition labels often have minor inconsistencies between reported kcal and 4P+4C+9F.
- **Decision:** Caloric totals are deterministically computed as `4 * protein + 4 * carbs + 9 * fat` (Atwater factors) to prevent UI discrepancies between macros and calories.

## ADR-003: Row Level Security on Every Table
- **Context:** Multi-tenant user privacy is critical for personal nutrition data.
- **Decision:** Every table enforces and forces RLS (`alter table ... force row level security`). `meal_items` check ensures the user owns both the item row and the parent `meals` row.

## ADR-004: Food Snapshots in Meal Items
- **Context:** Future updates to global food database entries or edits to custom foods must not rewrite historical meal logs.
- **Decision:** `meal_items` store snapshots of the food's per-100g macros (`protein_100`, `carbs_100`, `fat_100`) and name at log time.
