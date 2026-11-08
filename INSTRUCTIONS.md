You are building "MacroMeal", a secure, mobile-first calorie/macro web app
deployed on Vercel. The attached files are your complete spec:

- ARCHITECTURE.md  – stack, database schema with row-level security, API, security requirements, build phases
- SOLVER_TESTS.md  – test plan, golden values, calibration procedure, USDA import instructions
- reference_solver.py – independent reference solver for calibration

The core feature: the user sets a meal's macro target, adds foods, and the app
automatically calculates the grams of each food so the meal hits the target.
Adding, removing or locking a food instantly recalculates the others.

Rules:
1. Follow the stack and decisions in ARCHITECTURE.md exactly. Don't swap
   technologies without asking me.
2. Work in the phase order in section 10. Do NOT start any UI until the solver
   passes every test in SOLVER_TESTS.md and the calibration test passes with
   worst excess error <= 1.0 g.
3. Write the migrations, RLS policies and the RLS isolation tests BEFORE the
   queries that use them. User B must never be able to read or write user A's data.
4. The solver must be pure TypeScript with no framework imports. No LLM is
   involved in any calculation.
5. When something is ambiguous, pick the more secure and simpler option and
   record it in DECISIONS.md.
6. Never put secrets in the repo. The Supabase service-role key may only be
   used in lib/server/food-cache.ts and the USDA import script.
7. UI design comes later from a separate design agent (UI_DESIGN.md).
   For now build functional, unstyled screens using Tailwind + shadcn defaults.

Start with Phase 0 and Phase 1 only. When they are done, stop and report:
what was built, test results (including the calibration number), any
deviations or security concerns, and what you need from me.
The USDA API key is in .env.local as USDA_API_KEY. Follow ARCHITECTURE.md §12.1 for how to handle it. Never print it, log it or commit it.

