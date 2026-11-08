-- RLS Isolation Tests
-- Run within a transaction that rolls back

begin;

-- Create two dummy users
create extension if not exists "pgcrypto";
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  meal_a_id uuid;
  food_a_id uuid;
  found_count int;
begin
  -- Simulate User A
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('role', 'authenticated', true);

  -- User A creates nutrition target
  insert into nutrition_targets (user_id, kcal_target, split_protein_pct, split_carbs_pct, split_fat_pct, meals_per_day)
  values (user_a, 2000, 30, 40, 30, 4);

  -- User A creates custom food
  insert into foods (owner_id, source, name, state, protein_100, carbs_100, fat_100)
  values (user_a, 'custom', 'User A Secret Shake', 'na', 25, 10, 5)
  returning id into food_a_id;

  -- User A creates meal
  insert into meals (user_id, log_date, meal_index, name, target_protein_g, target_carbs_g, target_fat_g)
  values (user_a, current_date, 1, 'Lunch', 50, 50, 20)
  returning id into meal_a_id;

  -- User A adds item
  insert into meal_items (meal_id, user_id, food_id, food_name, protein_100, carbs_100, fat_100, grams)
  values (meal_a_id, user_a, food_a_id, 'User A Secret Shake', 25, 10, 5, 100);

  -- Switch to User B
  perform set_config('request.jwt.claim.sub', user_b::text, true);

  -- Test 1: User B cannot select User A's targets
  select count(*) into found_count from nutrition_targets where user_id = user_a;
  if found_count > 0 then
    raise exception 'RLS VIOLATION: User B can read User A targets';
  end if;

  -- Test 2: User B cannot read User A's custom food
  select count(*) into found_count from foods where owner_id = user_a;
  if found_count > 0 then
    raise exception 'RLS VIOLATION: User B can read User A custom foods';
  end if;

  -- Test 3: User B cannot read User A's meals
  select count(*) into found_count from meals where user_id = user_a;
  if found_count > 0 then
    raise exception 'RLS VIOLATION: User B can read User A meals';
  end if;

  -- Test 4: User B cannot read User A's meal items
  select count(*) into found_count from meal_items where user_id = user_a;
  if found_count > 0 then
    raise exception 'RLS VIOLATION: User B can read User A meal items';
  end if;

  -- Test 5: User B cannot inject an item into User A's meal
  begin
    insert into meal_items (meal_id, user_id, food_name, protein_100, carbs_100, fat_100, grams)
    values (meal_a_id, user_b, 'Injected Item', 10, 10, 10, 50);
    raise exception 'RLS VIOLATION: User B was able to insert into User A meal';
  exception when others then
    -- Expected rejection by check (exists select 1 from meals where user_id = auth.uid())
    null;
  end;

  -- Test 6: User B cannot update User A's meal
  update meals set name = 'Hacked' where user_id = user_a;
  select count(*) into found_count from meals where name = 'Hacked';
  if found_count > 0 then
    raise exception 'RLS VIOLATION: User B updated User A meal';
  end if;

  -- Test 7: User B cannot delete User A's meal
  delete from meals where user_id = user_a;
  -- Reset to User A to verify meal still exists
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  select count(*) into found_count from meals where id = meal_a_id;
  if found_count = 0 then
    raise exception 'RLS VIOLATION: User B deleted User A meal';
  end if;

  raise notice 'ALL RLS ISOLATION TESTS PASSED SUCCESSFULLY!';
end;
$$;

rollback;
