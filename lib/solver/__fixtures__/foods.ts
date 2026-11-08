import { SolverFood } from "../types";

export const F: Record<string, SolverFood> = {
  chicken: {
    id: "chicken",
    name: "Chicken Breast (raw)",
    per100: { protein: 23, carbs: 0, fat: 1.2 },
    mode: "auto",
    defaultGrams: 150,
    maxGrams: 1000,
  },
  rice: {
    id: "rice",
    name: "White Rice (raw)",
    per100: { protein: 7, carbs: 80, fat: 0.6 },
    mode: "auto",
    defaultGrams: 100,
    maxGrams: 1000,
  },
  broccoli: {
    id: "broccoli",
    name: "Broccoli (raw)",
    per100: { protein: 2.8, carbs: 7, fat: 0.4 },
    mode: "auto",
    defaultGrams: 150,
    maxGrams: 1000,
  },
  oil: {
    id: "oil",
    name: "Olive Oil",
    per100: { protein: 0, carbs: 0, fat: 100 },
    mode: "auto",
    defaultGrams: 10,
    maxGrams: 60,
  },
  oats: {
    id: "oats",
    name: "Rolled Oats",
    per100: { protein: 13, carbs: 68, fat: 7 },
    mode: "auto",
    defaultGrams: 60,
    maxGrams: 1000,
  },
  pb: {
    id: "pb",
    name: "Peanut Butter",
    per100: { protein: 25, carbs: 20, fat: 50 },
    mode: "auto",
    defaultGrams: 15,
    maxGrams: 100,
  },
};
