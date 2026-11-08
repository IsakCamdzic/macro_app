"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMealBuilderStore } from "@/lib/stores/meal-builder-store";
import { FoodPickerSheet } from "@/components/FoodPickerSheet";
import { confirmMeal } from "@/lib/actions";
import { SolverFood } from "@/lib/solver";

interface MealPageProps {
  params: Promise<{ index: string }>;
}

export default function MealBuilderPage({ params }: MealPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const mealIndex = parseInt(resolvedParams.index, 10) || 1;

  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const targetP = parseFloat(searchParams.get("p") || "50");
  const targetC = parseFloat(searchParams.get("c") || "52.5");
  const targetF = parseFloat(searchParams.get("f") || "25");
  const mealName = searchParams.get("name") || (mealIndex === 1 ? "Breakfast" : mealIndex === 2 ? "High-Protein Lunch" : `Meal ${mealIndex}`);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const {
    target,
    roundTo,
    foods,
    result,
    initMeal,
    addFood,
    removeFood,
    toggleLock,
    setFixedGrams,
    setRoundTo,
    applySuggestion,
  } = useMealBuilderStore();

  useEffect(() => {
    // If foods are empty, initialize with the worked example from ARCHITECTURE.md §1 & §11
    const initialStaples: SolverFood[] = [
      {
        id: "chicken_breast_raw",
        name: "Chicken Breast (raw)",
        per100: { protein: 23.0, carbs: 0.0, fat: 1.2 },
        mode: "auto",
        minGrams: 0,
        maxGrams: 500,
        defaultGrams: 150,
      },
      {
        id: "white_rice_raw",
        name: "White Rice (raw)",
        per100: { protein: 7.0, carbs: 80.0, fat: 0.6 },
        mode: "auto",
        minGrams: 0,
        maxGrams: 400,
        defaultGrams: 75,
      },
      {
        id: "broccoli_raw",
        name: "Broccoli (raw)",
        per100: { protein: 2.8, carbs: 7.0, fat: 0.4 },
        mode: "fixed",
        fixedGrams: 150,
      },
    ];

    initMeal(
      { protein: targetP, carbs: targetC, fat: targetF },
      mealIndex,
      mealName,
      date,
      foods.length > 0 ? foods : initialStaples
    );
  }, [mealIndex, date, targetP, targetC, targetF, mealName]);

  const handleConfirm = async () => {
    if (result.items.length === 0) return;
    setConfirming(true);

    const itemsPayload = result.items.map((it, idx) => {
      const origFood = foods.find((f) => f.id === it.foodId);
      return {
        foodId: null,
        foodName: it.foodName,
        protein100: origFood?.per100.protein || 0,
        carbs100: origFood?.per100.carbs || 0,
        fat100: origFood?.per100.fat || 0,
        grams: it.grams,
        isLocked: it.isFixed,
        position: idx,
      };
    });

    const res = await confirmMeal({
      mealId: `${date}:${mealIndex}`,
      items: itemsPayload,
    });

    setConfirming(false);
    if (res.ok) {
      setSuccessToast(true);
      setTimeout(() => {
        router.push("/today");
      }, 1200);
    }
  };

  const status = result.status;
  const isExact = status === "exact";
  const isClose = status === "close";

  // Relative percentages for progress bars
  const pPct = Math.min(100, Math.round((result.achieved.protein / Math.max(1, target.protein)) * 100));
  const cPct = Math.min(100, Math.round((result.achieved.carbs / Math.max(1, target.carbs)) * 100));
  const fPct = Math.min(100, Math.round((result.achieved.fat / Math.max(1, target.fat)) * 100));

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-28">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe">
        <div className="max-w-md mx-auto h-14 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <Link
              href="/today"
              aria-label="Go Back"
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors -ml-2"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                Meal Builder
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-caption text-[11px] font-semibold">
                Meal {mealIndex}
              </span>
            </div>
          </div>

          {/* Rounding Precision Toggle */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-surface-container">
            <button
              onClick={() => setRoundTo(1)}
              className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${
                roundTo === 1
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              1g
            </button>
            <button
              onClick={() => setRoundTo(5)}
              className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${
                roundTo === 5
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              5g
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col relative w-full pt-16 max-w-md mx-auto px-margin gap-space-md">
        {/* Success Toast */}
        {successToast && (
          <div className="p-3 rounded-xl bg-primary text-on-primary font-semibold text-sm flex items-center justify-between shadow-lg animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Meal confirmed & logged!</span>
            </div>
            <span className="text-xs opacity-80">Returning to Today...</span>
          </div>
        )}

        {/* Live Solver Status Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-high relative overflow-hidden">
          {/* Ambient Glow */}
          <div
            className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none transition-colors duration-500 ${
              isExact ? "bg-primary-fixed/40" : "bg-tertiary-fixed/40"
            }`}
          />

          {/* Top Row: Energy & Delta Alert */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caption text-label-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                Computed Energy
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight tabular-nums font-bold">
                  {result.kcal}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">
                  kcal
                </span>
              </div>
            </div>

            {/* Zero-Guilt Delta Tag */}
            <div
              className={`flex items-center gap-1 px-space-sm py-1 rounded-full font-label-caption text-label-caption font-semibold ${
                isExact
                  ? "bg-primary-fixed text-on-primary-fixed"
                  : isClose
                  ? "bg-secondary-fixed text-on-secondary-fixed"
                  : "bg-tertiary-fixed/70 text-on-tertiary-fixed"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {isExact ? "verified" : "balance"}
              </span>
              <span>
                {isExact
                  ? "Exact · Target Met"
                  : result.delta.fat < -2
                  ? `Under target · ${Math.abs(result.delta.fat)}g F`
                  : result.delta.protein < -2
                  ? `Under target · ${Math.abs(result.delta.protein)}g P`
                  : result.delta.carbs < -2
                  ? `Under target · ${Math.abs(result.delta.carbs)}g C`
                  : "Close to Target"}
              </span>
            </div>
          </div>

          {/* Macro Progress Instrument Rows */}
          <div className="flex flex-col gap-space-sm pt-space-xs">
            {/* Protein */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center font-label-caption text-label-caption">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="font-medium text-on-surface">Protein</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-on-surface font-semibold tabular-nums">
                    {result.achieved.protein} / {target.protein} g
                  </span>
                  {Math.abs(result.delta.protein) <= Math.max(1, 0.02 * target.protein) ? (
                    <span
                      className="material-symbols-outlined text-[15px] text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-on-surface-variant font-semibold">
                      {result.delta.protein > 0 ? `+${result.delta.protein}g` : `${result.delta.protein}g`}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-300"
                  style={{ width: `${pPct}%` }}
                />
              </div>
            </div>

            {/* Carbs */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center font-label-caption text-label-caption">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary" />
                  <span className="font-medium text-on-surface">Carbs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-on-surface font-semibold tabular-nums">
                    {result.achieved.carbs} / {target.carbs} g
                  </span>
                  {Math.abs(result.delta.carbs) <= Math.max(1, 0.02 * target.carbs) ? (
                    <span
                      className="material-symbols-outlined text-[15px] text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-on-surface-variant font-semibold">
                      {result.delta.carbs > 0 ? `+${result.delta.carbs}g` : `${result.delta.carbs}g`}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-tertiary rounded-full transition-all duration-300"
                  style={{ width: `${cPct}%` }}
                />
              </div>
            </div>

            {/* Fat */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center font-label-caption text-label-caption">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#c4553d]" />
                  <span className="font-medium text-on-surface">Fat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-on-surface font-semibold tabular-nums">
                    {result.achieved.fat} / {target.fat} g
                  </span>
                  {Math.abs(result.delta.fat) <= Math.max(1, 0.02 * target.fat) ? (
                    <span
                      className="material-symbols-outlined text-[15px] text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-[#c4553d] font-semibold">
                      {result.delta.fat > 0 ? `+${result.delta.fat}g` : `${result.delta.fat}g`}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#c4553d] rounded-full transition-all duration-300"
                  style={{ width: `${fPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Explanation Accordion */}
          {result.notes.length > 0 && (
            <details className="group bg-surface-container-low rounded-xl transition-all overflow-hidden border border-surface-container mt-1">
              <summary className="list-none flex items-center justify-between px-space-md py-2 cursor-pointer select-none">
                <div className="flex items-center gap-1.5 text-on-surface-variant font-label-caption text-label-caption">
                  <span className="material-symbols-outlined text-[16px] text-primary">info</span>
                  <span className="font-medium">How this was calculated</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="px-space-md pb-2 font-label-caption text-label-caption text-on-surface-variant leading-relaxed">
                {result.notes.join(" ")}
              </div>
            </details>
          )}
        </section>

        {/* Suggestion Banner */}
        {result.suggestions.length > 0 && !isExact && (
          <div className="bg-surface-container-low rounded-2xl p-space-md flex items-center justify-between gap-space-md border border-surface-container shadow-sm animate-in fade-in">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-9 h-9 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed shrink-0">
                <span className="material-symbols-outlined text-[20px]">lightbulb</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs text-on-surface truncate">
                  Smart Adjustment Suggestion
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {result.suggestions[0].message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => applySuggestion(result.suggestions[0])}
              className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-semibold text-xs shrink-0 shadow-sm hover:opacity-90 active:scale-95 transition-transform"
            >
              Apply Fix
            </button>
          </div>
        )}

        {/* Ingredients Header & Add Food Trigger */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              Meal Ingredients
            </h2>
            <span className="text-xs bg-surface-container-high text-on-surface-variant font-semibold px-2 py-0.5 rounded-full">
              {result.items.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-semibold hover:bg-primary hover:text-on-primary transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Food
          </button>
        </div>

        {/* Ingredients Items List */}
        <div className="flex flex-col gap-space-sm">
          {result.items.map((item) => {
            const food = foods.find((f) => f.id === item.foodId);
            const isLocked = item.isFixed;

            return (
              <div
                key={item.foodId}
                className="p-space-md rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-sm flex flex-col gap-2 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center font-bold text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-primary">
                        restaurant
                      </span>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-on-surface">{item.foodName}</h4>
                      <p className="text-[11px] text-on-surface-variant">
                        {isLocked ? "Fixed portion locked" : "Portion auto-calculated by solver"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Lock / Auto Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleLock(item.foodId, item.grams)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isLocked
                          ? "bg-tertiary-fixed text-on-tertiary-fixed font-semibold"
                          : "text-outline hover:text-on-surface hover:bg-surface-container"
                      }`}
                      title={isLocked ? "Unlock to let solver adjust" : "Lock this exact gram portion"}
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={isLocked ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {isLocked ? "lock" : "lock_open"}
                      </span>
                    </button>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => removeFood(item.foodId)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-error hover:bg-surface-container transition-colors"
                      title="Remove from meal"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>

                {/* Stepper & Macro Row */}
                <div className="mt-1 flex items-center justify-between pt-2 border-t border-surface-container-high">
                  {/* Gram Stepper */}
                  <div className="flex items-center bg-surface-container-low rounded-xl border border-surface-container-high p-0.5">
                    <button
                      type="button"
                      onClick={() => setFixedGrams(item.foodId, Math.max(0, item.grams - roundTo))}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface font-bold active:scale-90 transition-transform"
                    >
                      –
                    </button>
                    <div className="px-2.5 flex items-baseline gap-0.5">
                      <span className="font-bold text-sm tabular-nums text-on-surface">
                        {Math.round(item.grams)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-medium">g</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFixedGrams(item.foodId, item.grams + roundTo)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface font-bold active:scale-90 transition-transform"
                    >
                      +
                    </button>
                  </div>

                  {/* Calculated Macro Contribution */}
                  <div className="flex items-center gap-3 font-mono text-[11px] text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      {item.macros.protein}g
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                      {item.macros.carbs}g
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c4553d]" />
                      {item.macros.fat}g
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-surface-container-high p-space-md pb-safe">
        <div className="max-w-md mx-auto flex items-center gap-space-sm">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="h-12 px-4 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Food</span>
          </button>

          <button
            type="button"
            disabled={confirming || result.items.length === 0}
            onClick={handleConfirm}
            className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            <span>{confirming ? "Verifying..." : `Confirm & Cook (${result.kcal} kcal)`}</span>
          </button>
        </div>
      </div>

      {/* Food Picker Sheet */}
      <FoodPickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAddFood={addFood}
        fatNeeded={result.delta.fat < -3}
        proteinNeeded={result.delta.protein < -3}
        carbsNeeded={result.delta.carbs < -3}
      />
    </div>
  );
}
