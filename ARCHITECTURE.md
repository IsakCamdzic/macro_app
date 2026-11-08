# MacroMeal — Architecture & Build Specification

> Audience: the engineering agent that will build this app.
> Companion document: `UI_DESIGN.md` (owned by the design agent). Do not invent UI decisions that contradict it; if the two conflict on behaviour, this file wins on logic and `UI_DESIGN.md` wins on visuals.

Working name: **MacroMeal** (rename freely).

---

## 1. Product summary

A mobile-first web app (installable PWA) for tracking daily calories and macros with the least possible friction.

The defining feature: **the user does not log grams and hope for the best. The app tells them how many grams of each food to cook so the meal lands on its macro target.**

Core flow:

1. User signs up / signs in.
2. Onboarding: enters **daily calories**, picks a **macro split** (protein / carbs / fat %), and a **number of meals per day**.
3. App divides daily macros evenly across meals. Each meal gets a target (P / C / F grams, kcal derived).
4. In a meal, the user adds foods ("chicken breast, rice, broccoli"). The **solver** returns grams per food so the meal hits the target.
5. User cooks, confirms, and the meal is logged. Dashboard shows daily progress.
6. Multiple users, fully isolated data.

### Worked example (also an acceptance test, see §11)

Meal target: **50 g protein, 52.5 g carbs, 25 g fat** (= 635 kcal).
Foods: chicken breast, white rice, broccoli.

Important reality check the app must handle gracefully: chicken, rice and broccoli together contain almost no fat, so 25 g fat is **not reachable** with those three foods. The app must not output nonsense (negative grams or silently wrong macros). It must report the shortfall and suggest a fix (e.g. "add ~22 g olive oil"). See §5.4.

---

## 2. Technology decisions (final — do not re-litigate)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** | First-class Vercel deploy, server actions, middleware |
| Hosting | **Vercel** | Requested |
| Database | **Postgres via Supabase** | Real relational DB, Row Level Security enforces tenant isolation at the DB layer |
| Auth | **Supabase Auth** (email + password, magic link optional, Google OAuth optional) with `@supabase/ssr` cookie sessions | Battle-tested; httpOnly cookies; MFA (TOTP) available |
| Validation | **Zod** on every boundary | Single source of truth for types |
| Styling | **Tailwind CSS** + CSS variables for tokens defined in `UI_DESIGN.md` | |
| UI primitives | **Radix UI / shadcn-ui** | Accessible by default |
| Server state | **TanStack Query** | Caching, optimistic updates |
| Local state | **Zustand** (meal builder draft only) | |
| Rate limiting | **Upstash Redis + `@upstash/ratelimit`** | Works on Vercel edge/serverless |
| Food data | **USDA FoodData Central** (generic ingredients) + **Open Food Facts** (packaged / barcode) + user custom foods | Free, legal to use |
| Testing | **Vitest** (unit), **Playwright** (e2e), **pgTAP or SQL script** (RLS tests) | |
| Lint/format | ESLint (strict), Prettier, `tsc --noEmit` in CI | |
| CI | GitHub Actions: typecheck, lint, unit, RLS tests, e2e, `npm audit` | |

**No LLM in the calculation path.** Numbers come from deterministic code only. (An optional future "describe your meal in words" parser may use an LLM to extract food names, but it must never produce macro numbers or grams.)

---

## 3. System architecture

```
┌───────────────────────────── Phone / Browser (PWA) ─────────────────────────────┐
│  React UI  ──►  Zustand (meal draft)  ──►  Solver (pure TS, runs locally)       │
│      │                     ▲                                                    │
│      │ TanStack Query      │ instant recompute on every change (no network)     │
└──────┼─────────────────────┼────────────────────────────────────────────────────┘
       │ HTTPS (Server Actions / Route Handlers), httpOnly session cookie
┌──────▼─────────────────────────── Vercel (Next.js) ──────────────────────────────┐
│  middleware.ts  → refresh session, redirect unauthenticated, security headers    │
│  Server Actions → Zod validate → authz check → rate limit → DB (user-scoped JWT) │
│  /api/foods/search → proxy to USDA/OFF (API keys stay server-side) + cache       │
│  lib/solver (same package, re-runs authoritatively before persisting a meal)     │
└──────┬───────────────────────────────────────────────────────────────┬───────────┘
       │ user-scoped Supabase client (anon key + user JWT → RLS applies)│
┌──────▼───────────────┐                                  ┌────────────▼──────────┐
│ Supabase Postgres    │                                  │ Upstash Redis         │
│ RLS on every table   │                                  │ rate limit counters   │
│ Supabase Auth        │                                  └───────────────────────┘
└──────────────────────┘
```

### Key architectural principles

1. **Security lives in the database.** RLS is the real authorization layer; application checks are defense in depth, not the only defense.
2. **The solver is a pure, framework-free module** (`/lib/solver`) with zero imports from React, Next, or Supabase. It runs in the browser for instant feedback and on the server for authoritative verification at save time.
3. **The server never trusts client-computed macros.** On save it recomputes macros from `grams × per-100g values` fetched from the DB, not from client payload.
4. **Food snapshots.** A logged meal stores a snapshot of each food's per-100g values at log time, so editing/deleting a food or a database refresh never rewrites history.
5. **Least privilege.** The Supabase **service-role key is used only** in one server-only module (`/lib/server/food-cache.ts`, marked with `import "server-only"`) for inserting global cached foods. It is never imported anywhere else, never exposed to the client, never prefixed `NEXT_PUBLIC_`.
6. **Offline-tolerant shell.** PWA with cached app shell; logging requires network in v1 (no offline sync).

---

## 4. Domain model & targets

### 4.1 Daily target computation

User inputs:
- `kcal_target` (integer, 800–10000 range validated)
- `split`: protein %, carbs %, fat % (integers, must sum to 100; default **30 / 40 / 30**)
- `meals_per_day` (integer 1–8)

Compute:
```
protein_g_day = kcal * p% / 4
carbs_g_day   = kcal * c% / 4
fat_g_day     = kcal * f% / 9
per meal      = day values / meals_per_day   (even split by default)
```
Energy constants: 4 / 4 / 9 kcal per g (Atwater). **Calories are always derived from macros** (`kcal = 4P + 4C + 9F`) in the solver and UI so numbers never disagree. Food labels' own kcal are stored for display only.

Advanced (v1.1, design for it now): alternate input mode "protein in g/kg bodyweight" and uneven meal split (e.g. bigger dinner). Model `meals` targets as stored per-meal values so uneven splits need no schema change.

Targets are **versioned** (`effective_from`) so changing a target tomorrow does not rewrite past days.

### 4.2 Units
Grams everywhere internally. Display grams; optional oz toggle is out of scope for v1. Food `state` (`raw` | `cooked` | `na`) must be shown next to every food, because 100 g raw rice ≠ 100 g cooked rice. Default to **raw** for rice/pasta/meat database entries and label it clearly.

---

## 5. The Solver (core IP — build this carefully)

Location: `/lib/solver/`. Pure TypeScript, no dependencies beyond optionally a tiny linear-algebra helper. Fully unit-tested.

### 5.1 Types

```ts
type Macros = { protein: number; carbs: number; fat: number };          // grams

type SolverFood = {
  id: string;
  name: string;
  per100: Macros;                      // grams of macro per 100 g of food
  mode: "auto" | "fixed";              // fixed = user locked the grams
  fixedGrams?: number;                 // required when mode === "fixed"
  minGrams?: number;                   // default 0
  maxGrams?: number;                   // default 1000 (sane cap; oils default 60)
  defaultGrams?: number;               // portion prior, e.g. 150
};

type SolverInput = {
  target: Macros;
  foods: SolverFood[];
  roundTo?: 1 | 5;                     // default 1
};

type SolverResult = {
  status: "exact" | "close" | "infeasible";
  items: { foodId: string; grams: number; macros: Macros }[];
  achieved: Macros;
  delta: Macros;                       // achieved - target
  kcal: number;                        // derived 4/4/9
  suggestions: Suggestion[];           // populated unless status === "exact"
  notes: string[];                     // human-readable explanation lines
};
```

### 5.2 Formulation

1. Subtract contribution of all `fixed` foods from the target → **residual target** `T'` (clamp each component at 0, but record that it was over-consumed).
2. Let `A` be the 3×n matrix with `A[k][i] = per100_i[k] / 100` (grams of macro k per gram of food i), `g` the vector of grams for auto foods.
3. Solve the **bounded, regularised, relative least squares**:

```
minimise   Σ_k  w_k · ((A g − T')_k / max(T'_k, 1))²   +   λ · Σ_i ((g_i − g0_i) / max(g0_i, 1))²
subject to minGrams_i ≤ g_i ≤ maxGrams_i
```
- `w_k = 1` for all macros by default (configurable; protein could be weighted ×1.5 later).
- `g0_i` = `defaultGrams` or a role-based prior (protein source 150 g, carb source 100 g, veg 150 g, fat source 10 g).
- `λ = 1e-3` — a tie-breaker that makes the answer **unique and sensible when n > 3** (underdetermined) and keeps portions realistic. It must be small enough that it never visibly harms the macro fit when an exact solution exists.
- Relative error scaling stops carbs (large numbers) dominating fat (small numbers).

4. Algorithm: **bounded-variable least squares via an active-set method** (or equivalently Lawson–Hanson NNLS with bound shifting). n is tiny (≤ ~10), so correctness and determinism matter far more than speed. Do **not** use random or iterative-until-it-looks-right heuristics. Same input must always give the same output.

5. **Rounding:** round each gram value to `roundTo`, then **recompute achieved macros from the rounded grams** (never report pre-rounding numbers). Optionally run a small local search (±roundTo on each food) to pick the rounded combination with the lowest error.

### 5.3 Status classification (after rounding)

- `exact`: every macro within `max(1 g, 2 %)` of target.
- `close`: every macro within 10 % of target.
- `infeasible`: otherwise.

### 5.4 Suggestions engine (the "smart" part)

When status ≠ `exact`:

1. Identify the macro with the largest **relative** shortfall or overshoot.
2. Shortfall → candidate foods ranked by: user favourites > recently used > small curated list of staples per dominant-macro (olive oil, peanut butter, nuts, rice, oats, whey, egg whites, chicken breast, etc. — seed data), filtered to foods whose dominant macro matches the shortfall.
3. For each of the top 3 candidates, **re-run the solver with that food added** and keep it only if it improves the status or reduces total relative error by > 25 %.
4. Overshoot → suggest which food to reduce/replace (e.g. "peanut butter pushes fat over by 6 g — try a leaner protein").
5. Return as `Suggestion { kind: "add" | "swap" | "reduce", foodId, grams?, resultingStatus, message }`.

Also provide `notes`, e.g. "Chicken sets your protein. Rice sets your carbs. Fat is 21 g short — no food in this meal contains enough fat."

### 5.5 Edge cases the solver must handle (each needs a unit test)

- 1 food, 2 foods, 3 foods (square system), 4+ foods (underdetermined).
- Foods with duplicate / collinear macro profiles (two white-rice entries) → no NaN, no exploding grams.
- A target component of 0 (e.g. 0 g fat meal).
- All foods with 0 of a required macro.
- A fixed food that already exceeds the target.
- `maxGrams` binding.
- Zero-calorie foods (water, spices): excluded from solving, shown at user-chosen grams.
- Very large and very small targets.
- Output must **never contain NaN, Infinity, or negative grams**.

### 5.6 Performance & placement
Runs synchronously in < 5 ms. Executes client-side on every food/lock change. Executes again server-side on save (authoritative) and the server rejects saves where the client's reported achieved macros differ from the server's recomputation by more than 1 g.

---

## 6. Database schema (Postgres)

All tables: `uuid` PKs (`gen_random_uuid()`), `created_at timestamptz default now()`, RLS **enabled and forced**.

```sql
-- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

-- versioned daily targets
create table nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kcal_target int not null check (kcal_target between 800 and 10000),
  split_protein_pct smallint not null check (split_protein_pct between 0 and 100),
  split_carbs_pct   smallint not null check (split_carbs_pct   between 0 and 100),
  split_fat_pct     smallint not null check (split_fat_pct     between 0 and 100),
  meals_per_day smallint not null check (meals_per_day between 1 and 8),
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  check (split_protein_pct + split_carbs_pct + split_fat_pct = 100)
);
create index on nutrition_targets (user_id, effective_from desc);

-- foods: global (owner_id null) cache + user custom foods
create table foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,   -- null = global
  source text not null check (source in ('usda','off','custom','seed')),
  external_id text,
  name text not null check (char_length(name) between 1 and 120),
  brand text,
  state text not null default 'na' check (state in ('raw','cooked','na')),
  protein_100 numeric(6,2) not null check (protein_100 between 0 and 100),
  carbs_100   numeric(6,2) not null check (carbs_100   between 0 and 100),
  fat_100     numeric(6,2) not null check (fat_100     between 0 and 100),
  default_portion_g numeric(6,1),
  created_at timestamptz not null default now(),
  check (protein_100 + carbs_100 + fat_100 <= 100.5),
  check ((source = 'custom') = (owner_id is not null))
);
create unique index foods_global_ext on foods (source, external_id) where owner_id is null;
create index foods_name_trgm on foods using gin (name gin_trgm_ops);   -- enable pg_trgm

-- a meal slot on a date
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  meal_index smallint not null check (meal_index between 1 and 8),
  name text check (char_length(name) <= 60),
  target_protein_g numeric(6,1) not null,
  target_carbs_g   numeric(6,1) not null,
  target_fat_g     numeric(6,1) not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, log_date, meal_index)
);

-- items in a meal (snapshot of food values)
create table meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,   -- denormalised for simple RLS
  food_id uuid references foods(id) on delete set null,
  food_name text not null,
  protein_100 numeric(6,2) not null,
  carbs_100   numeric(6,2) not null,
  fat_100     numeric(6,2) not null,
  grams numeric(7,1) not null check (grams > 0 and grams <= 5000),
  is_locked boolean not null default false,
  position smallint not null default 0
);

-- reusable meals / favourites
create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  items jsonb not null,           -- [{foodId, grams?, isLocked}] validated with Zod before insert
  created_at timestamptz not null default now()
);

create table favourite_foods (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references foods(id) on delete cascade,
  primary key (user_id, food_id)
);
```

### 6.1 RLS policies (required pattern)

```sql
alter table <t> enable row level security;
alter table <t> force row level security;

-- user-owned tables (nutrition_targets, meals, meal_items, saved_meals, favourite_foods, profiles)
create policy "own rows select" on <t> for select using (user_id = auth.uid());
create policy "own rows insert" on <t> for insert with check (user_id = auth.uid());
create policy "own rows update" on <t> for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on <t> for delete using (user_id = auth.uid());
-- (profiles uses id = auth.uid())

-- foods
create policy "read global or own" on foods for select
  using (owner_id is null or owner_id = auth.uid());
create policy "insert own custom" on foods for insert
  with check (owner_id = auth.uid() and source = 'custom');
create policy "update own custom" on foods for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and source = 'custom');
create policy "delete own custom" on foods for delete using (owner_id = auth.uid());
-- no insert policy for global rows: only the service-role cache module writes them.
```

Additional meal_items policy: inserts must also verify the parent `meal_id` belongs to `auth.uid()`:
```sql
with check (user_id = auth.uid() and exists (select 1 from meals m where m.id = meal_id and m.user_id = auth.uid()))
```

A trigger creates a `profiles` row on `auth.users` insert.

---

## 7. API surface (Server Actions / Route Handlers)

Every action: **(1)** get session, reject if none → **(2)** rate-limit by user id (and IP for unauth) → **(3)** Zod-parse input → **(4)** query via the **user-scoped** Supabase client → **(5)** return typed result `{ ok: true, data } | { ok: false, error: { code, message } }`. No raw error objects or stack traces to the client.

| Action | Purpose |
|---|---|
| `saveTargets(input)` | Validate split sums to 100, insert new versioned target |
| `getTodayPlan(date)` | Targets in effect + meals + items + progress |
| `searchFoods(q)` | Debounced search: own custom + global cache; if < N hits, call USDA/OFF through the proxy, cache results |
| `lookupBarcode(code)` | (v1.1) Open Food Facts |
| `createCustomFood(input)` | Per-100g macros; validated bounds |
| `updateCustomFood / deleteCustomFood` | Own foods only |
| `solveMeal(input)` | Optional server-side solver call (same pure module) |
| `confirmMeal(mealId, items)` | **Recompute server-side**, reject mismatch > 1 g, persist snapshot |
| `saveMealTemplate / listTemplates / deleteTemplate` | Favourite meals |
| `getHistory(range)` | Daily totals for charts |
| `exportMyData()` | JSON export of everything the user owns |
| `deleteAccount()` | Delete user (cascades) after re-auth |

Search proxy rules: query length ≤ 80, strip control chars, 10 req/min per user, results cached 24 h, upstream timeouts 3 s, graceful fallback to local results.

---

## 8. Security requirements (non-negotiable)

Nutrition and body data is health-adjacent personal data. Treat it accordingly.

**Authentication & sessions**
- Supabase Auth with `@supabase/ssr`; sessions in **httpOnly, Secure, SameSite=Lax** cookies. No tokens in `localStorage`.
- Email verification required before data access.
- Password policy: min 12 chars; enable leaked-password protection (HIBP) in Supabase.
- Optional TOTP MFA enrollment in Settings.
- Generic auth error messages (no account enumeration); rate limit sign-in / sign-up / reset (5 per 15 min per IP + per email).
- Re-authentication required for: change email/password, delete account, export data.

**Authorization**
- RLS on every table (see §6). A CI test must prove **user B cannot select / insert / update / delete user A's rows** on every table, including via `meal_items` with a foreign `meal_id`.
- Never use the service-role key outside `/lib/server/food-cache.ts`. A lint rule / grep check in CI fails the build if `SUPABASE_SERVICE_ROLE_KEY` appears elsewhere.

**Input & output**
- Zod schemas on every action and route handler; reject unknown keys (`.strict()`).
- Numeric bounds mirrored in DB `check` constraints.
- No dynamic SQL string building. Use the Supabase client / parameterised queries only.
- React escapes output by default; never use `dangerouslySetInnerHTML`.

**Transport & headers** (set in `next.config.js` / middleware)
- `Content-Security-Policy` with per-request nonce, `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, connect-src limited to own origin + Supabase project URL.
- `Strict-Transport-Security` (2 years, includeSubDomains, preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/mic/geolocation (camera enabled only on the barcode route in v1.1).
- CSRF: Server Actions + SameSite cookies; verify `Origin` on custom route handlers.

**Secrets & supply chain**
- All secrets in Vercel env vars; `.env.example` committed, `.env*` git-ignored. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public.
- Lockfile committed; Dependabot on; `npm audit --omit=dev` in CI; pin major versions; minimal dependencies.
- Rotate keys if ever leaked; document in `SECURITY.md`.

**Privacy**
- Data export and account deletion implemented (GDPR-style; users may be in the EU).
- No third-party analytics by default. If added later: privacy-friendly, cookieless, no PII.
- Logs contain user id at most — never emails, never macro values tied to identity.
- Privacy policy + terms stub pages. Add a medical disclaimer ("not medical advice") in onboarding and Settings.

**Abuse protection**
- Upstash rate limits on: auth routes, food search, custom food creation (50/day), meal confirm.
- Request body size limits; cap items per meal (≤ 20), meals per day (≤ 8), custom foods per user (≤ 500).

---

## 9. Project structure

```
/app
  (auth)/sign-in, sign-up, reset
  (app)/today, meal/[index], history, foods, settings
  api/foods/search/route.ts
/components            // UI only; no business logic
/lib
  /solver              // PURE. index.ts, solve.ts, suggest.ts, types.ts, *.test.ts
  /targets             // daily → per-meal computation, pure + tested
  /validation          // Zod schemas shared client/server
  /supabase            // server.ts, client.ts, middleware.ts (user-scoped clients)
  /server              // server-only: food-cache.ts (service role), ratelimit.ts, usda.ts, off.ts
/supabase/migrations   // SQL migrations incl. RLS
/supabase/tests        // RLS isolation tests
/e2e                   // Playwright
SECURITY.md  ARCHITECTURE.md  .env.example
```

Rules: `/lib/solver` and `/lib/targets` must not import from React, Next, or Supabase. Components must not call the DB directly; they go through actions/hooks.

---

## 10. Build phases

**Phase 0 — Foundation:** repo, TS strict, Tailwind, CI, Supabase project, migrations, RLS, auth flows, middleware, security headers, RLS isolation tests green.

**Phase 1 — Solver & targets (no UI):** `/lib/targets` and `/lib/solver` with full unit tests including §5.5 and §11 cases. Do this **before** any meal UI.

**Phase 2 — Onboarding & Today:** targets form, per-meal division, dashboard with daily progress.

**Phase 3 — Meal builder:** food search + custom foods, live solver, lock/fixed grams, suggestions, confirm (server re-verification), snapshotting.

**Phase 4 — Polish:** templates/favourites, history & charts, export, delete account, PWA manifest + icons + offline shell, MFA, empty/error/loading states, accessibility pass.

**Phase 5 (v1.1):** barcode scan, uneven meal split, protein-per-kg mode, copy yesterday, oz/lb units.

---

## 11. Acceptance criteria

**Solver (illustrative per-100 g values; use seed data equivalents)**
- chicken breast raw ≈ 23 P / 0 C / 1.2 F · white rice raw ≈ 7 P / 80 C / 0.6 F · broccoli ≈ 2.8 P / 7 C / 0.4 F · olive oil 0 / 0 / 100.
1. Target 50 / 52.5 / 25 with **chicken + rice + broccoli(locked 150 g)**: status `infeasible`, fat shortfall ≈ 20+ g reported, top suggestion is **add olive oil ≈ 20–23 g**, never negative grams.
2. Same target with **chicken + rice + broccoli(locked 150 g) + olive oil**: status `exact`; roughly chicken ≈ 180 g, rice ≈ 52 g, oil ≈ 22 g (verify numerically in test with ±1 g macro tolerance).
3. Determinism: 1000 repeated solves of the same input return byte-identical output.
4. Fuzz test: 5,000 random valid inputs → no NaN / Infinity / negative values; `achieved` always equals recomputation from returned grams.
5. Solve time < 5 ms for 10 foods.

**Security**
6. RLS isolation test suite passes for all tables.
7. `grep` for service-role key outside `/lib/server/food-cache.ts` returns nothing.
8. Security headers present (checked via Playwright against preview deploy); securityheaders.com grade A or better.
9. Unauthenticated request to any `(app)` route redirects to sign-in; unauthenticated action call returns `UNAUTHENTICATED`.
10. Sign-in rate limit trips after threshold.

**Product**
11. New user can go sign-up → onboarding → first confirmed meal in under 3 minutes (e2e timed).
12. Two users on the same deployment never see each other's data (e2e with two sessions).
13. Lighthouse (mobile): Performance ≥ 90, Accessibility ≥ 95, PWA installable.
14. Data export returns all the user's rows; account deletion removes them all (verified by e2e + DB check).

---

## 12. Deployment

- GitHub repo → Vercel project; preview deploys per PR; production on `main`.
- Supabase: separate **dev** and **prod** projects. Migrations applied via Supabase CLI in CI.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `USDA_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Supabase Auth settings: site URL + redirect allow-list for the Vercel domain(s), email confirmation on, leaked password protection on.
- Enable daily Supabase backups (or PITR on paid tier).

---

## 13. Explicitly out of scope for v1

Social features, meal-photo recognition, wearable sync, micronutrient tracking, native mobile apps, offline write-sync, payments, coaching features.

---

## 14. Instructions to the build agent

- Build in the phase order above. Do not start UI before the solver passes §11.
- Prefer boring, well-known solutions. Every dependency needs a reason.
- When a requirement is ambiguous, choose the option that is **more secure and simpler**, and record the decision in `DECISIONS.md`.
- Write the migration SQL, RLS policies and RLS tests **before** the queries that use them.
- After each phase, run the full test suite and report: what's done, what's deferred, any security concerns found.
