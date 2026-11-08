-- Enable extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- 1. profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

-- 2. versioned daily targets
create table if not exists nutrition_targets (
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
create index if not exists nutrition_targets_user_effective on nutrition_targets (user_id, effective_from desc);

-- 3. foods: global (owner_id null) cache + user custom foods
create table if not exists foods (
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
create unique index if not exists foods_global_ext on foods (source, external_id) where owner_id is null;
create index if not exists foods_name_trgm on foods using gin (name gin_trgm_ops);

-- 4. a meal slot on a date
create table if not exists meals (
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

-- 5. items in a meal (snapshot of food values)
create table if not exists meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references foods(id) on delete set null,
  food_name text not null,
  protein_100 numeric(6,2) not null,
  carbs_100   numeric(6,2) not null,
  fat_100     numeric(6,2) not null,
  grams numeric(7,1) not null check (grams > 0 and grams <= 5000),
  is_locked boolean not null default false,
  position smallint not null default 0
);

-- 6. reusable meals / favourites
create table if not exists saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  items jsonb not null,
  created_at timestamptz not null default now()
);

-- 7. favourite foods
create table if not exists favourite_foods (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references foods(id) on delete cascade,
  primary key (user_id, food_id)
);

-- Profile creation trigger on auth.users insert
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ROW LEVEL SECURITY (RLS)
alter table profiles enable row level security;
alter table profiles force row level security;
create policy "profiles_select" on profiles for select using (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

alter table nutrition_targets enable row level security;
alter table nutrition_targets force row level security;
create policy "targets_select" on nutrition_targets for select using (user_id = auth.uid());
create policy "targets_insert" on nutrition_targets for insert with check (user_id = auth.uid());
create policy "targets_update" on nutrition_targets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "targets_delete" on nutrition_targets for delete using (user_id = auth.uid());

alter table meals enable row level security;
alter table meals force row level security;
create policy "meals_select" on meals for select using (user_id = auth.uid());
create policy "meals_insert" on meals for insert with check (user_id = auth.uid());
create policy "meals_update" on meals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meals_delete" on meals for delete using (user_id = auth.uid());

alter table meal_items enable row level security;
alter table meal_items force row level security;
create policy "meal_items_select" on meal_items for select using (user_id = auth.uid());
create policy "meal_items_insert" on meal_items for insert with check (
  user_id = auth.uid() and exists (
    select 1 from meals m where m.id = meal_id and m.user_id = auth.uid()
  )
);
create policy "meal_items_update" on meal_items for update using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from meals m where m.id = meal_id and m.user_id = auth.uid()
  )
);
create policy "meal_items_delete" on meal_items for delete using (user_id = auth.uid());

alter table foods enable row level security;
alter table foods force row level security;
create policy "foods_select" on foods for select using (owner_id is null or owner_id = auth.uid());
create policy "foods_insert" on foods for insert with check (owner_id = auth.uid() and source = 'custom');
create policy "foods_update" on foods for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and source = 'custom');
create policy "foods_delete" on foods for delete using (owner_id = auth.uid());

alter table saved_meals enable row level security;
alter table saved_meals force row level security;
create policy "saved_meals_select" on saved_meals for select using (user_id = auth.uid());
create policy "saved_meals_insert" on saved_meals for insert with check (user_id = auth.uid());
create policy "saved_meals_update" on saved_meals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_meals_delete" on saved_meals for delete using (user_id = auth.uid());

alter table favourite_foods enable row level security;
alter table favourite_foods force row level security;
create policy "favourite_foods_select" on favourite_foods for select using (user_id = auth.uid());
create policy "favourite_foods_insert" on favourite_foods for insert with check (user_id = auth.uid());
create policy "favourite_foods_delete" on favourite_foods for delete using (user_id = auth.uid());

-- Seed data for foundational foods
insert into foods (id, source, external_id, name, brand, state, protein_100, carbs_100, fat_100, default_portion_g)
values
  ('11111111-1111-1111-1111-111111111001', 'seed', 'chicken_breast_raw', 'Chicken Breast (raw)', null, 'raw', 23.0, 0.0, 1.2, 150),
  ('11111111-1111-1111-1111-111111111002', 'seed', 'white_rice_raw', 'White Rice (raw)', null, 'raw', 7.0, 80.0, 0.6, 75),
  ('11111111-1111-1111-1111-111111111003', 'seed', 'broccoli_raw', 'Broccoli (raw)', null, 'raw', 2.8, 7.0, 0.4, 150),
  ('11111111-1111-1111-1111-111111111004', 'seed', 'olive_oil', 'Extra Virgin Olive Oil', 'Bertolli', 'na', 0.0, 0.0, 100.0, 15),
  ('11111111-1111-1111-1111-111111111005', 'seed', 'oats_raw', 'Rolled Oats (raw)', 'Quaker', 'raw', 13.5, 68.0, 7.0, 50),
  ('11111111-1111-1111-1111-111111111006', 'seed', 'whey_protein', '100% Whey Protein', 'Optimum Nutrition', 'na', 80.0, 5.0, 3.0, 30),
  ('11111111-1111-1111-1111-111111111007', 'seed', 'peanut_butter', 'Natural Peanut Butter', null, 'na', 25.0, 20.0, 50.0, 32),
  ('11111111-1111-1111-1111-111111111008', 'seed', 'whole_egg_raw', 'Whole Large Egg', null, 'raw', 12.6, 0.8, 9.5, 50),
  ('11111111-1111-1111-1111-111111111009', 'seed', 'salmon_fillet_raw', 'Atlantic Salmon Fillet', null, 'raw', 20.0, 0.0, 13.0, 150),
  ('11111111-1111-1111-1111-111111111010', 'seed', 'sweet_potato_raw', 'Sweet Potato (raw)', null, 'raw', 1.6, 20.1, 0.1, 150)
on conflict do nothing;
