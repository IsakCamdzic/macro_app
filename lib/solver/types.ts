export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface SolverFood {
  id: string;
  name: string;
  per100: Macros;
  mode: "auto" | "fixed";
  fixedGrams?: number;
  minGrams?: number;
  maxGrams?: number;
  defaultGrams?: number;
}

export interface SolverInput {
  target: Macros;
  foods: SolverFood[];
  roundTo?: 1 | 5;
}

export interface Suggestion {
  kind: "add" | "swap" | "reduce";
  foodId?: string;
  foodName?: string;
  grams?: number;
  resultingStatus?: "exact" | "close" | "infeasible";
  message: string;
}

export interface SolverItemResult {
  foodId: string;
  foodName: string;
  grams: number;
  macros: Macros;
  isFixed: boolean;
}

export interface SolverResult {
  status: "exact" | "close" | "infeasible";
  items: SolverItemResult[];
  achieved: Macros;
  delta: Macros;
  kcal: number;
  suggestions: Suggestion[];
  notes: string[];
}
