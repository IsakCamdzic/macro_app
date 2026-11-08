"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { searchFoods, toggleFavouriteFood, createCustomFood } from "@/lib/actions";

export default function FoodsPage() {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<any[]>([]);
  const [tab, setTab] = useState<"all" | "favourites" | "custom">("all");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // New Food form
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [state, setState] = useState<"raw" | "cooked" | "na">("raw");
  const [protein100, setProtein100] = useState(25);
  const [carbs100, setCarbs100] = useState(0);
  const [fat100, setFat100] = useState(5);
  const [errorMsg, setErrorMsg] = useState("");

  const loadFoods = () => {
    setLoading(true);
    searchFoods(query)
      .then((res) => {
        if (res.ok) setFoods(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFoods();
  }, [query]);

  const handleToggleFav = async (foodId: string) => {
    const res = await toggleFavouriteFood(foodId);
    if (res.ok) {
      setFoods((prev) =>
        prev.map((f) => (f.id === foodId ? { ...f, is_favourite: res.data.isFavourite } : f))
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const res = await createCustomFood({
      name,
      brand: brand || null,
      state,
      protein100: Number(protein100),
      carbs100: Number(carbs100),
      fat100: Number(fat100),
      defaultPortionG: 100,
    });

    if (res.ok) {
      setShowModal(false);
      setName("");
      setBrand("");
      loadFoods();
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const filteredFoods = foods.filter((f) => {
    if (tab === "favourites") return f.is_favourite;
    if (tab === "custom") return f.source === "custom";
    return true;
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-24">
      <AppHeader
        title="MacroMeal"
        subtitle="Food Database"
        rightAction={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-sm hover:opacity-90 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Custom Food</span>
          </button>
        }
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 max-w-md mx-auto px-margin gap-space-md">
        {/* Search */}
        <div className="relative flex items-center w-full h-11 bg-surface-container-low rounded-xl px-3 border border-surface-container-high focus-within:border-primary transition-all">
          <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staples, branded, or custom foods..."
            className="w-full bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-outline hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">cancel</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              tab === "all"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            All Foods ({foods.length})
          </button>
          <button
            onClick={() => setTab("favourites")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
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
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              tab === "custom"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            My Custom Foods
          </button>
        </div>

        {/* List */}
        <div className="flex flex-col gap-space-sm pb-10">
          {loading && (
            <div className="text-center py-8 text-on-surface-variant text-sm">Loading foods...</div>
          )}

          {!loading && filteredFoods.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">
                restaurant
              </span>
              <p className="text-sm font-medium text-on-surface-variant">No foods found</p>
            </div>
          )}

          {filteredFoods.map((food) => (
            <div
              key={food.id}
              className="p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-sm flex flex-col gap-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-on-surface">{food.name}</h4>
                  <div className="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5">
                    {food.brand && <span>{food.brand} • </span>}
                    <span className="capitalize">{food.state}</span>
                    <span>•</span>
                    <span className="uppercase text-[10px] font-bold tracking-wider text-outline">
                      {food.source}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleFav(food.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-tertiary transition-colors"
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={food.is_favourite ? { fontVariationSettings: "'FILL' 1", color: "#d9961a" } : undefined}
                  >
                    grade
                  </span>
                </button>
              </div>

              {/* Nutrition per 100g */}
              <div className="pt-2 border-t border-surface-container-high flex items-center justify-between text-xs font-mono">
                <span className="text-[11px] font-sans text-on-surface-variant font-medium">
                  Per 100g:
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-secondary font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    {food.protein_100}g P
                  </span>
                  <span className="flex items-center gap-1 text-tertiary font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    {food.carbs_100}g C
                  </span>
                  <span className="flex items-center gap-1 text-[#c4553d] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c4553d]" />
                    {food.fat_100}g F
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl p-space-lg shadow-2xl border border-surface-container-high flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <h3 className="font-headline-md font-semibold text-on-surface">New Custom Food</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-2 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Greek Yogurt 2%"
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-low border text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Brand (optional)
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Fage"
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-low border text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  State
                </label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["raw", "cooked", "na"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setState(s)}
                      className={`h-8 rounded-lg text-xs font-semibold capitalize border ${
                        state === s
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container border-surface-container-high text-on-surface"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-2">
                <span className="text-xs font-semibold text-on-surface">Macros per 100g</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-secondary">Protein</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={protein100}
                      onChange={(e) => setProtein100(Number(e.target.value))}
                      className="mt-1 w-full h-9 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-tertiary">Carbs</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={carbs100}
                      onChange={(e) => setCarbs100(Number(e.target.value))}
                      className="mt-1 w-full h-9 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#c4553d]">Fat</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={fat100}
                      onChange={(e) => setFat100(Number(e.target.value))}
                      className="mt-1 w-full h-9 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
              >
                Save Food
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
