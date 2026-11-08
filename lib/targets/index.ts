export interface DailyTargetInput {
  kcalTarget: number;
  splitProteinPct: number;
  splitCarbsPct: number;
  splitFatPct: number;
  mealsPerDay: number;
}

export interface MacroTarget {
  protein: number;
  carbs: number;
  fat: number;
  kcal: number;
}

export interface TargetPlan {
  daily: MacroTarget;
  perMeal: MacroTarget;
  mealsPerDay: number;
}

/**
 * Atwater factors: 4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat
 */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(4 * protein + 4 * carbs + 9 * fat);
}

/**
 * Computes daily macro targets in grams from target calories and percentage splits,
 * and distributes them evenly across the requested number of meals.
 */
export function computeTargetPlan(input: DailyTargetInput): TargetPlan {
  const { kcalTarget, splitProteinPct, splitCarbsPct, splitFatPct, mealsPerDay } = input;

  if (kcalTarget < 800 || kcalTarget > 10000) {
    throw new Error(`kcalTarget must be between 800 and 10000, got ${kcalTarget}`);
  }
  if (splitProteinPct + splitCarbsPct + splitFatPct !== 100) {
    throw new Error(`Macro split must sum to 100%, got ${splitProteinPct + splitCarbsPct + splitFatPct}`);
  }
  if (mealsPerDay < 1 || mealsPerDay > 8) {
    throw new Error(`mealsPerDay must be between 1 and 8, got ${mealsPerDay}`);
  }

  // Grams per day rounded to 1 decimal place
  const proteinDay = Number(((kcalTarget * (splitProteinPct / 100)) / 4).toFixed(1));
  const carbsDay = Number(((kcalTarget * (splitCarbsPct / 100)) / 4).toFixed(1));
  const fatDay = Number(((kcalTarget * (splitFatPct / 100)) / 9).toFixed(1));
  const dailyKcal = kcalFromMacros(proteinDay, carbsDay, fatDay);

  // Per meal values
  const proteinMeal = Number((proteinDay / mealsPerDay).toFixed(1));
  const carbsMeal = Number((carbsDay / mealsPerDay).toFixed(1));
  const fatMeal = Number((fatDay / mealsPerDay).toFixed(1));
  const mealKcal = kcalFromMacros(proteinMeal, carbsMeal, fatMeal);

  return {
    daily: {
      protein: proteinDay,
      carbs: carbsDay,
      fat: fatDay,
      kcal: dailyKcal,
    },
    perMeal: {
      protein: proteinMeal,
      carbs: carbsMeal,
      fat: fatMeal,
      kcal: mealKcal,
    },
    mealsPerDay,
  };
}
