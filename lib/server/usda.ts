import "server-only";
import { CachedFoodInsert, upsertGlobalFoodCache } from "./food-cache";

export async function searchUSDA(query: string): Promise<CachedFoodInsert[]> {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
    query
  )}&pageSize=8&api_key=${apiKey}&dataType=Foundation,Survey%20(FNDDS)`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const json = await res.json();
    const foods: CachedFoodInsert[] = [];

    for (const item of json.foods || []) {
      let p = 0;
      let c = 0;
      let f = 0;

      for (const nutrient of item.foodNutrients || []) {
        const id = nutrient.nutrientId;
        const num = nutrient.value || 0;
        if (id === 1003) p = num; // Protein
        else if (id === 1005) c = num; // Carbs
        else if (id === 1004) f = num; // Fat
      }

      if (p + c + f > 0 && p + c + f <= 100.5) {
        foods.push({
          source: "usda",
          external_id: String(item.fdcId),
          name: item.description?.slice(0, 120) || "Generic food",
          brand: item.brandOwner?.slice(0, 100) || null,
          state: item.description?.toLowerCase().includes("cooked") ? "cooked" : "raw",
          protein_100: Number(p.toFixed(2)),
          carbs_100: Number(c.toFixed(2)),
          fat_100: Number(f.toFixed(2)),
          default_portion_g: 100,
        });
      }
    }

    // Cache in global database asynchronously
    if (foods.length > 0) {
      upsertGlobalFoodCache(foods).catch(() => {});
    }

    return foods;
  } catch {
    return [];
  }
}
