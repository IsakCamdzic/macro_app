/**
 * Local-only USDA FoodData Central Bulk Importer.
 *
 * Imports generic food ingredients from USDA SR Legacy and Foundation Foods CSVs
 * into the Supabase `foods` table as global rows (owner_id: null, source: 'usda').
 *
 * Usage:
 *   npx tsx scripts/import-usda.ts
 *
 * Never deploy this script to production runtime.
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { createClient } from "@supabase/supabase-js";

interface USDAFoodRecord {
  source: "usda";
  owner_id: null;
  external_id: string;
  name: string;
  brand: string | null;
  state: "raw" | "cooked" | "na";
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  default_portion_g: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function loadEnv(): { url: string; key: string } {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found in project root");
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      env[k] = v;
    }
  }

  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !key) {
    throw new Error(
      "Missing Supabase credentials in .env.local. Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY"
    );
  }

  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}.supabase.co`;
  return { url, key };
}

function determineFoodState(description: string): "raw" | "cooked" | "na" {
  const lower = description.toLowerCase();
  const rawKeywords = ["raw", "fresh", "uncooked"];
  const cookedKeywords = [
    "cooked",
    "boiled",
    "baked",
    "roasted",
    "fried",
    "broiled",
    "grilled",
    "steamed",
    "microwaved",
    "toasted",
  ];

  if (rawKeywords.some((w) => lower.includes(w))) {
    return "raw";
  }
  if (cookedKeywords.some((w) => lower.includes(w))) {
    return "cooked";
  }
  return "na";
}

async function verifyNutrients(nutrientCsvPath: string): Promise<Record<string, string>> {
  if (!fs.existsSync(nutrientCsvPath)) {
    throw new Error(`nutrient.csv not found at: ${nutrientCsvPath}`);
  }

  const fileStream = fs.createReadStream(nutrientCsvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const foundNutrients: Record<string, string> = {};
  let isFirstLine = true;
  let idCol = 0;
  let nameCol = 1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (isFirstLine) {
      isFirstLine = false;
      idCol = cols.indexOf("id");
      nameCol = cols.indexOf("name");
      continue;
    }

    const id = cols[idCol]?.trim();
    const name = cols[nameCol]?.trim();
    if (["1003", "1004", "1005", "1008"].includes(id)) {
      foundNutrients[id] = name;
    }
  }

  if (!foundNutrients["1003"] || !foundNutrients["1004"] || !foundNutrients["1005"]) {
    throw new Error(
      `Required macro nutrients not verified in ${nutrientCsvPath}. Found: ${JSON.stringify(foundNutrients)}`
    );
  }

  console.log(`✓ Nutrient IDs verified in ${path.basename(nutrientCsvPath)}:`);
  console.log(`    1003: ${foundNutrients["1003"]} (Protein)`);
  console.log(`    1004: ${foundNutrients["1004"]} (Fat)`);
  console.log(`    1005: ${foundNutrients["1005"]} (Carbohydrates)`);
  if (foundNutrients["1008"]) {
    console.log(`    1008: ${foundNutrients["1008"]} (Energy)`);
  }

  return foundNutrients;
}

async function loadPortions(portionCsvPath: string): Promise<Map<string, number>> {
  const portions = new Map<string, number>();
  if (!fs.existsSync(portionCsvPath)) {
    return portions;
  }

  const fileStream = fs.createReadStream(portionCsvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isFirstLine = true;
  let fdcIdCol = 1;
  let gramWeightCol = 7;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (isFirstLine) {
      isFirstLine = false;
      fdcIdCol = cols.indexOf("fdc_id");
      gramWeightCol = cols.indexOf("gram_weight");
      continue;
    }

    const fdcId = cols[fdcIdCol]?.trim();
    const gw = parseFloat(cols[gramWeightCol]?.trim() || "");
    if (fdcId && !isNaN(gw) && gw > 0 && !portions.has(fdcId)) {
      portions.set(fdcId, Number(gw.toFixed(1)));
    }
  }

  return portions;
}

async function loadNutrients(foodNutrientCsvPath: string): Promise<Map<string, { p?: number; f?: number; c?: number }>> {
  const macroMap = new Map<string, { p?: number; f?: number; c?: number }>();
  if (!fs.existsSync(foodNutrientCsvPath)) {
    throw new Error(`food_nutrient.csv not found at: ${foodNutrientCsvPath}`);
  }

  const fileStream = fs.createReadStream(foodNutrientCsvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isFirstLine = true;
  let fdcIdCol = 1;
  let nutrientIdCol = 2;
  let amountCol = 3;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (isFirstLine) {
      isFirstLine = false;
      fdcIdCol = cols.indexOf("fdc_id");
      nutrientIdCol = cols.indexOf("nutrient_id");
      amountCol = cols.indexOf("amount");
      continue;
    }

    const nutrientId = cols[nutrientIdCol]?.trim();
    if (nutrientId !== "1003" && nutrientId !== "1004" && nutrientId !== "1005") {
      continue;
    }

    const fdcId = cols[fdcIdCol]?.trim();
    if (!fdcId) continue;

    const amount = parseFloat(cols[amountCol]?.trim() || "0");
    if (isNaN(amount) || amount < 0) continue;

    let entry = macroMap.get(fdcId);
    if (!entry) {
      entry = {};
      macroMap.set(fdcId, entry);
    }

    if (nutrientId === "1003") entry.p = amount;
    else if (nutrientId === "1004") entry.f = amount;
    else if (nutrientId === "1005") entry.c = amount;
  }

  return macroMap;
}

async function parseDatasetFoods(
  datasetDir: string,
  filterDataType?: string
): Promise<{
  foods: USDAFoodRecord[];
  skippedMissing: number;
  skippedOverSum: number;
}> {
  const foodCsvPath = path.join(datasetDir, "food.csv");
  const nutrientCsvPath = path.join(datasetDir, "nutrient.csv");
  const foodNutrientCsvPath = path.join(datasetDir, "food_nutrient.csv");
  const foodPortionCsvPath = path.join(datasetDir, "food_portion.csv");

  if (!fs.existsSync(foodCsvPath)) {
    throw new Error(`food.csv not found in directory: ${datasetDir}`);
  }

  // 1. Verify nutrients
  await verifyNutrients(nutrientCsvPath);

  // 2. Load portions
  console.log(`  Loading portion weights from ${path.basename(foodPortionCsvPath)}...`);
  const portions = await loadPortions(foodPortionCsvPath);

  // 3. Load nutrients
  console.log(`  Loading macros from ${path.basename(foodNutrientCsvPath)}...`);
  const macroMap = await loadNutrients(foodNutrientCsvPath);

  // 4. Parse foods
  console.log(`  Processing ${path.basename(foodCsvPath)}...`);
  const fileStream = fs.createReadStream(foodCsvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const foods: USDAFoodRecord[] = [];
  let skippedMissing = 0;
  let skippedOverSum = 0;

  let isFirstLine = true;
  let fdcIdCol = 0;
  let descCol = 2;
  let dataTypeCol = 1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (isFirstLine) {
      isFirstLine = false;
      fdcIdCol = cols.indexOf("fdc_id");
      descCol = cols.indexOf("description");
      dataTypeCol = cols.indexOf("data_type");
      continue;
    }

    const dataType = cols[dataTypeCol]?.trim();
    if (filterDataType && dataType !== filterDataType) {
      continue;
    }

    const fdcId = cols[fdcIdCol]?.trim();
    const description = cols[descCol]?.trim();
    if (!fdcId || !description) continue;

    const macros = macroMap.get(fdcId);
    if (!macros || macros.p === undefined || macros.f === undefined || macros.c === undefined) {
      skippedMissing++;
      continue;
    }

    const p = Number(macros.p.toFixed(2));
    const fat = Number(macros.f.toFixed(2));
    const c = Number(macros.c.toFixed(2));

    if (p + fat + c > 100.5) {
      skippedOverSum++;
      continue;
    }

    const state = determineFoodState(description);
    const defaultPortion = portions.get(fdcId) ?? 100;

    foods.push({
      source: "usda",
      owner_id: null,
      external_id: fdcId,
      name: description.slice(0, 120),
      brand: null,
      state,
      protein_100: p,
      fat_100: fat,
      carbs_100: c,
      default_portion_g: defaultPortion,
    });
  }

  return { foods, skippedMissing, skippedOverSum };
}

async function findDatasetDirectories(): Promise<string[]> {
  const customArg = process.argv[2];
  if (customArg && fs.existsSync(customArg)) {
    return [path.resolve(customArg)];
  }

  const searchRoots = [
    path.resolve(process.cwd(), "data/usda"),
  ];

  const foundDirs: string[] = [];
  const seen = new Set<string>();

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;

    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      if (files.includes("food.csv") && files.includes("food_nutrient.csv") && files.includes("nutrient.csv")) {
        if (!seen.has(dir)) {
          seen.add(dir);
          foundDirs.push(dir);
        }
        return;
      }
      for (const f of files) {
        const sub = path.join(dir, f);
        if (fs.statSync(sub).isDirectory()) {
          walk(sub);
        }
      }
    };

    walk(root);
  }

  return foundDirs;
}

async function main() {
  console.log("=================================================");
  console.log("   MacroMeal — USDA FoodData Central Bulk Import");
  console.log("=================================================\n");

  const { url, key } = loadEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const datasetDirs = await findDatasetDirectories();

  if (datasetDirs.length === 0) {
    console.error("ERROR: No extracted USDA dataset directories found.");
    console.log("\nTo import USDA bulk data:");
    console.log("1. Go to https://fdc.nal.usda.gov/download-datasets");
    console.log("2. Download the CSV files for:");
    console.log("   - SR Legacy Foods (e.g. FoodData_Central_sr_legacy_food_csv_2018-04.zip)");
    console.log("   - Foundation Foods (e.g. FoodData_Central_foundation_food_csv_2021-10-28.zip)");
    console.log("3. Unzip them into: ./data/usda/<dataset-name>/");
    console.log("4. Re-run: npx tsx scripts/import-usda.ts");
    process.exit(1);
  }

  console.log(`Found ${datasetDirs.length} dataset director${datasetDirs.length > 1 ? "ies" : "y"}:`);
  datasetDirs.forEach((d) => console.log(`  - ${d}`));
  console.log("");

  const allFoodsMap = new Map<string, USDAFoodRecord>();
  let totalSkippedMissing = 0;
  let totalSkippedOverSum = 0;

  for (const dir of datasetDirs) {
    console.log(`\n--- Reading dataset from: ${dir} ---`);
    const isFoundationDir = dir.toLowerCase().includes("foundation");
    const filterDataType = isFoundationDir ? "foundation_food" : undefined;

    const { foods, skippedMissing, skippedOverSum } = await parseDatasetFoods(dir, filterDataType);
    console.log(`  Parsed ${foods.length} valid foods from this directory.`);
    totalSkippedMissing += skippedMissing;
    totalSkippedOverSum += skippedOverSum;

    for (const f of foods) {
      allFoodsMap.set(f.external_id, f);
    }
  }

  const allFoods = Array.from(allFoodsMap.values());
  console.log(`\nTotal unique valid foods prepared for database import: ${allFoods.length}`);
  console.log(`Total skipped (missing required macros): ${totalSkippedMissing}`);
  console.log(`Total skipped (macros sum > 100.5g): ${totalSkippedOverSum}\n`);

  if (allFoods.length === 0) {
    console.log("No foods to insert.");
    return;
  }

  // Batch insert into Supabase
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  console.log(`Importing into Supabase 'foods' table in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < allFoods.length; i += BATCH_SIZE) {
    const batch = allFoods.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("foods").upsert(batch, {
      onConflict: "source,external_id",
    });

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      throw error;
    }

    insertedCount += batch.length;
    process.stdout.write(`  Imported ${insertedCount} / ${allFoods.length} foods...\r`);
  }

  console.log(`\n✓ Successfully imported and updated ${insertedCount} global USDA foods in Supabase!\n`);

  // Report 10 sample rows
  console.log("-------------------------------------------------------------------------------------------------------------");
  console.log("10 Sample Rows from Imported USDA Foods:");
  console.log("-------------------------------------------------------------------------------------------------------------");
  const samples = allFoods.slice(0, 10);
  console.table(
    samples.map((s) => ({
      external_id: s.external_id,
      name: s.name.length > 50 ? s.name.slice(0, 47) + "..." : s.name,
      state: s.state,
      P_100g: s.protein_100,
      C_100g: s.carbs_100,
      F_100g: s.fat_100,
      portion_g: s.default_portion_g,
    }))
  );
  console.log("-------------------------------------------------------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  process.exit(1);
});
