import "server-only";
import { CachedFoodInsert, upsertGlobalFoodCache } from "./food-cache";

export async function searchOpenFoodFacts(query: string): Promise<CachedFoodInsert[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    query
  )}&search_simple=1&action=process&json=1&page_size=8`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MacroMealApp - Web - Version 1.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const json = await res.json();
    const foods: CachedFoodInsert[] = [];

    for (const item of json.products || []) {
      const nutriments = item.nutriments || {};
      const p = Number(nutriments.proteins_100g || 0);
      const c = Number(nutriments.carbohydrates_100g || 0);
      const f = Number(nutriments.fat_100g || 0);

      const name = item.product_name || item.generic_name;
      if (name && p + c + f > 0 && p + c + f <= 100.5) {
        foods.push({
          source: "off",
          external_id: String(item.code || item.id),
          name: name.slice(0, 120),
          brand: item.brands?.slice(0, 100) || null,
          state: "na",
          protein_100: Number(p.toFixed(2)),
          carbs_100: Number(c.toFixed(2)),
          fat_100: Number(f.toFixed(2)),
          default_portion_g: 100,
        });
      }
    }

    if (foods.length > 0) {
      upsertGlobalFoodCache(foods).catch(() => {});
    }

    return foods;
  } catch {
    return [];
  }
}
