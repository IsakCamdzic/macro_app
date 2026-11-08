import { create } from "zustand";
import { Macros, SolverFood, SolverResult, solveMeal, Suggestion } from "@/lib/solver";

interface MealBuilderState {
  target: Macros;
  mealIndex: number;
  mealName: string;
  date: string;
  roundTo: 1 | 5;
  foods: SolverFood[];
  result: SolverResult;

  // Actions
  initMeal: (
    target: Macros,
    mealIndex: number,
    mealName: string,
    date: string,
    initialFoods?: SolverFood[]
  ) => void;
  addFood: (food: Omit<SolverFood, "mode"> & { mode?: "auto" | "fixed" }) => void;
  removeFood: (foodId: string) => void;
  toggleLock: (foodId: string, currentGrams?: number) => void;
  setFixedGrams: (foodId: string, grams: number) => void;
  setRoundTo: (roundTo: 1 | 5) => void;
  applySuggestion: (suggestion: Suggestion) => void;
}

const defaultTarget: Macros = { protein: 50, carbs: 52.5, fat: 25 };

export const useMealBuilderStore = create<MealBuilderState>((set, get) => ({
  target: defaultTarget,
  mealIndex: 1,
  mealName: "Lunch",
  date: new Date().toISOString().split("T")[0],
  roundTo: 1,
  foods: [],
  result: solveMeal({ target: defaultTarget, foods: [], roundTo: 1 }),

  initMeal: (target, mealIndex, mealName, date, initialFoods = []) => {
    const roundTo = get().roundTo;
    const result = solveMeal({ target, foods: initialFoods, roundTo });
    set({
      target,
      mealIndex,
      mealName,
      date,
      foods: initialFoods,
      result,
    });
  },

  addFood: (food) => {
    const { foods, target, roundTo } = get();
    // Don't duplicate if already present
    if (foods.some((f) => f.id === food.id)) return;

    const newFood: SolverFood = {
      ...food,
      mode: food.mode || "auto",
    };

    const newFoods = [...foods, newFood];
    const newResult = solveMeal({ target, foods: newFoods, roundTo });
    set({ foods: newFoods, result: newResult });
  },

  removeFood: (foodId) => {
    const { foods, target, roundTo } = get();
    const newFoods = foods.filter((f) => f.id !== foodId);
    const newResult = solveMeal({ target, foods: newFoods, roundTo });
    set({ foods: newFoods, result: newResult });
  },

  toggleLock: (foodId, currentGrams) => {
    const { foods, target, roundTo, result } = get();
    const itemResult = result.items.find((it) => it.foodId === foodId);
    const solvedGrams = currentGrams ?? itemResult?.grams ?? 100;

    const newFoods = foods.map((f) => {
      if (f.id === foodId) {
        const nextMode = f.mode === "fixed" ? "auto" : "fixed";
        return {
          ...f,
          mode: nextMode as "auto" | "fixed",
          fixedGrams: nextMode === "fixed" ? solvedGrams : undefined,
        };
      }
      return f;
    });

    const newResult = solveMeal({ target, foods: newFoods, roundTo });
    set({ foods: newFoods, result: newResult });
  },

  setFixedGrams: (foodId, grams) => {
    const { foods, target, roundTo } = get();
    const safeGrams = Math.max(0, Math.min(5000, grams));
    const newFoods = foods.map((f) => {
      if (f.id === foodId) {
        return {
          ...f,
          mode: "fixed" as const,
          fixedGrams: safeGrams,
        };
      }
      return f;
    });

    const newResult = solveMeal({ target, foods: newFoods, roundTo });
    set({ foods: newFoods, result: newResult });
  },

  setRoundTo: (roundTo) => {
    const { foods, target } = get();
    const newResult = solveMeal({ target, foods, roundTo });
    set({ roundTo, result: newResult });
  },

  applySuggestion: (suggestion) => {
    if (suggestion.kind === "add" && suggestion.foodId) {
      const { foods, target, roundTo } = get();
      // Look up staple or add
      const newFood: SolverFood = {
        id: suggestion.foodId,
        name: suggestion.foodName || "Suggested Food",
        per100: suggestion.foodId.includes("olive_oil")
          ? { protein: 0, carbs: 0, fat: 100 }
          : { protein: 20, carbs: 20, fat: 20 },
        mode: "auto",
        maxGrams: suggestion.foodId.includes("oil") ? 60 : 1000,
      };

      if (!foods.some((f) => f.id === newFood.id)) {
        const newFoods = [...foods, newFood];
        const newResult = solveMeal({ target, foods: newFoods, roundTo });
        set({ foods: newFoods, result: newResult });
      }
    } else if (suggestion.kind === "reduce" && suggestion.foodId) {
      const { foods, target, roundTo, result } = get();
      const currentItem = result.items.find((i) => i.foodId === suggestion.foodId);
      const reducedG = currentItem ? Math.max(10, Math.round(currentItem.grams * 0.7)) : 50;

      const newFoods = foods.map((f) =>
        f.id === suggestion.foodId ? { ...f, mode: "fixed" as const, fixedGrams: reducedG } : f
      );
      const newResult = solveMeal({ target, foods: newFoods, roundTo });
      set({ foods: newFoods, result: newResult });
    }
  },
}));
