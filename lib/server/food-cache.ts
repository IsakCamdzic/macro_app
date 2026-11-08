import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client strictly isolated to inserting / caching global food items
 * fetched from USDA / Open Food Facts.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface CachedFoodInsert {
  source: "usda" | "off" | "seed";
  external_id: string;
  name: string;
  brand?: string | null;
  state: "raw" | "cooked" | "na";
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  default_portion_g?: number | null;
}

export async function upsertGlobalFoodCache(foods: CachedFoodInsert[]) {
  const client = getServiceClient();
  if (!client || foods.length === 0) return;

  await client
    .from("foods")
    .upsert(
      foods.map((f) => ({
        ...f,
        owner_id: null,
      })),
      { onConflict: "source,external_id" }
    );
}
