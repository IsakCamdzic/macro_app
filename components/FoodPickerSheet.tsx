"use client";

import { useState, useEffect } from "react";
import { searchFoods, toggleFavouriteFood, createCustomFood } from "@/lib/actions";
import { SolverFood } from "@/lib/solver";

interface FoodPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFood: (food: SolverFood) => void;
  fatNeeded?: boolean;
  proteinNeeded?: boolean;
  carbsNeeded?: boolean;
}

export function FoodPickerSheet({
  isOpen,
  onClose,
  onAddFood,
  fatNeeded = false,
  proteinNeeded = false,
  carbsNeeded = false,
}: FoodPickerSheetProps) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<any[]>([]);
  const [tab, setTab] = useState<"all" | "favourites" | "recent" | "custom">("all");
  const [loading, setLoading] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);

  // Custom food form state
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customState, setCustomState] = useState<"raw" | "cooked" | "na">("raw");
  const [customP, setCustomP] = useState(20);
  const [customC, setCustomC] = useState(0);
  const [customF, setCustomF] = useState(5);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    searchFoods(query)
      .then((res) => {
        if (res.ok) setFoods(res.data);
      })
      .finally(() => setLoading(false));
  }, [isOpen, query]);

  if (!isOpen) return null;

  const handleToggleFav = async (e: React.MouseEvent, foodId: string) => {
    e.stopPropagation();
    const res = await toggleFavouriteFood(foodId);
    if (res.ok) {
      setFoods((prev) =>
        prev.map((f) => (f.id === foodId ? { ...f, is_favourite: res.data.isFavourite } : f))
      );
    }
  };

  const handleAdd = (food: any) => {
    onAddFood({
      id: food.id,
      name: food.name,
      per100: {
        protein: food.protein_100,
        carbs: food.carbs_100,
        fat: food.fat_100,
      },
      mode: "auto",
      maxGrams: food.fat_100 >= 50 ? 60 : 1000,
      defaultGrams: food.default_portion_g || 100,
    });
    onClose();
  };

  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setCreating(true);

    const res = await createCustomFood({
      name: customName,
      brand: customBrand || null,
      state: customState,
      protein100: Number(customP),
      carbs100: Number(customC),
      fat100: Number(customF),
      defaultPortionG: 100,
    });

    setCreating(false);
    if (res.ok) {
      handleAdd(res.data);
      setShowCreateCustom(false);
      setCustomName("");
    } else {
      setErrorMsg(res.error.message);
    }
  };

  // Filter foods by active tab
  const filteredFoods = foods.filter((f) => {
    if (tab === "favourites") return f.is_favourite;
    if (tab === "custom") return f.source === "custom";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md mx-auto bg-surface rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-surface-container-highest" />
        </div>

        {/* Header */}
        <div className="px-margin flex items-center justify-between pb-2">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
            Add Foods
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Search Input Recess */}
        <div className="px-margin py-2">
          <div className="relative flex items-center w-full h-11 bg-surface-container-low rounded-xl px-space-md border border-surface-container-high focus-within:border-primary transition-all">
            <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods (e.g. olive oil, rice, chicken)..."
              className="w-full bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="w-6 h-6 flex items-center justify-center text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-margin flex items-center gap-space-xs overflow-x-auto no-scrollbar py-2">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
              tab === "all"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            All Foods
          </button>
          <button
            onClick={() => setTab("favourites")}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors flex items-center gap-1 ${
              tab === "favourites"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">star</span>
            Favourites
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
              tab === "custom"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            My Custom Foods
          </button>
          <button
            onClick={() => setShowCreateCustom(true)}
            className="px-3 py-1 rounded-full text-xs font-semibold shrink-0 bg-primary-fixed text-on-primary-fixed hover:opacity-90 flex items-center gap-1 ml-auto"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            New Custom Food
          </button>
        </div>

        {/* Food List */}
        <div className="flex-1 overflow-y-auto px-margin py-2 flex flex-col gap-space-sm pb-10">
          {loading && (
            <div className="text-center py-8 text-on-surface-variant text-sm">
              Searching database...
            </div>
          )}

          {!loading && filteredFoods.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">
                restaurant_menu
              </span>
              <p className="text-sm font-medium text-on-surface-variant">No foods found</p>
              <button
                onClick={() => setShowCreateCustom(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
              >
                Create Custom Food
              </button>
            </div>
          )}

          {filteredFoods.map((food) => {
            const isFat = food.fat_100 >= 30;
            const isProtein = food.protein_100 >= 18;
            const isCarbs = food.carbs_100 >= 35;

            return (
              <div
                key={food.id}
                onClick={() => handleAdd(food)}
                className="flex flex-col p-3 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary/40 shadow-sm cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center font-bold text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-primary">
                        {isFat ? "water_drop" : isProtein ? "egg_alt" : "grain"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-on-surface">{food.name}</span>
                        {isFat && fatNeeded && (
                          <span className="px-1.5 py-0.2 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-semibold">
                            Matches Fat
                          </span>
                        )}
                        {isProtein && proteinNeeded && (
                          <span className="px-1.5 py-0.2 rounded bg-secondary-fixed text-on-secondary-fixed text-[10px] font-semibold">
                            Matches Protein
                          </span>
                        )}
                        {isCarbs && carbsNeeded && (
                          <span className="px-1.5 py-0.2 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-semibold">
                            Matches Carbs
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5">
                        {food.brand && <span>{food.brand} • </span>}
                        <span className="capitalize">{food.state}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleToggleFav(e, food.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-tertiary transition-colors"
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={food.is_favourite ? { fontVariationSettings: "'FILL' 1", color: "#d9961a" } : undefined}
                      >
                        grade
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdd(food)}
                      className="px-2.5 py-1 rounded-lg bg-primary-fixed text-on-primary-fixed font-semibold text-xs hover:bg-primary hover:text-on-primary transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Macro per 100g indicator */}
                <div className="mt-2 pt-1.5 border-t border-surface-container flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                  <span className="text-[10px] font-sans">Per 100g:</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      {food.protein_100}g P
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                      {food.carbs_100}g C
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c4553d]" />
                      {food.fat_100}g F
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Custom Food Sub-Modal */}
        {showCreateCustom && (
          <div className="absolute inset-0 bg-surface z-50 p-space-lg flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <h3 className="font-headline-md font-semibold text-on-surface">New Custom Food</h3>
              <button
                onClick={() => setShowCreateCustom(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveCustom} className="mt-4 flex flex-col gap-space-md">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase">
                  Food Name
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Greek Yogurt 0%, Salmon Bowl"
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-sm font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase">
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  placeholder="e.g. Fage, Kirkland"
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-sm font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase">
                  State
                </label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["raw", "cooked", "na"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCustomState(s)}
                      className={`h-9 rounded-xl text-xs font-semibold capitalize border ${
                        customState === s
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container border-surface-container-high text-on-surface"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-3">
                <span className="text-xs font-semibold text-on-surface">Macros per 100g</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-secondary">Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={customP}
                      onChange={(e) => setCustomP(Number(e.target.value))}
                      className="mt-1 w-full h-10 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-tertiary">Carbs (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={customC}
                      onChange={(e) => setCustomC(Number(e.target.value))}
                      className="mt-1 w-full h-10 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#c4553d]">Fat (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={customF}
                      onChange={(e) => setCustomF(Number(e.target.value))}
                      className="mt-1 w-full h-10 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="mt-4 w-full h-12 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
              >
                {creating ? "Saving..." : "Save & Add to Meal"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
