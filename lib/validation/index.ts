import { z } from "zod";

export const targetsSchema = z
  .object({
    kcalTarget: z.number().int().min(800).max(10000),
    splitProteinPct: z.number().int().min(0).max(100),
    splitCarbsPct: z.number().int().min(0).max(100),
    splitFatPct: z.number().int().min(0).max(100),
    mealsPerDay: z.number().int().min(1).max(8),
  })
  .strict()
  .refine(
    (data) => data.splitProteinPct + data.splitCarbsPct + data.splitFatPct === 100,
    {
      message: "Protein, carbs, and fat percentages must sum to 100%",
      path: ["splitProteinPct"],
    }
  );

export type TargetsInput = z.infer<typeof targetsSchema>;

export const customFoodSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().max(120).optional().nullable(),
    state: z.enum(["raw", "cooked", "na"]).default("na"),
    protein100: z.number().min(0).max(100),
    carbs100: z.number().min(0).max(100),
    fat100: z.number().min(0).max(100),
    defaultPortionG: z.number().min(1).max(2000).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => data.protein100 + data.carbs100 + data.fat100 <= 100.5,
    {
      message: "Sum of macros per 100g cannot exceed 100.5g",
      path: ["protein100"],
    }
  );

export type CustomFoodInput = z.infer<typeof customFoodSchema>;

export const confirmMealItemSchema = z
  .object({
    foodId: z.string().uuid().optional().nullable(),
    foodName: z.string().min(1).max(120),
    protein100: z.number().min(0).max(100),
    carbs100: z.number().min(0).max(100),
    fat100: z.number().min(0).max(100),
    grams: z.number().positive().max(5000),
    isLocked: z.boolean().default(false),
    position: z.number().int().min(0).max(50).default(0),
  })
  .strict();

export const confirmMealSchema = z
  .object({
    mealId: z.string().uuid(),
    items: z.array(confirmMealItemSchema).max(20),
  })
  .strict();

export type ConfirmMealInput = z.infer<typeof confirmMealSchema>;

export const searchFoodsQuerySchema = z
  .object({
    q: z.string().max(80).regex(/^[\p{L}\p{N}\s,.'"-]*$/u, "Invalid characters in query"),
  })
  .strict();
