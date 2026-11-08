"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { saveTargets, exportMyData, deleteAccount } from "@/lib/actions";
import { computeTargetPlan } from "@/lib/targets";

export default function SettingsPage() {
  const [kcal, setKcal] = useState(2200);
  const [splitP, setSplitP] = useState(30);
  const [splitC, setSplitC] = useState(40);
  const [splitF, setSplitF] = useState(30);
  const [meals, setMeals] = useState(4);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const totalSplit = splitP + splitC + splitF;
  const isSplitValid = totalSplit === 100;

  let planPreview = null;
  try {
    if (isSplitValid && kcal >= 800 && kcal <= 10000 && meals >= 1 && meals <= 8) {
      planPreview = computeTargetPlan({
        kcalTarget: kcal,
        splitProteinPct: splitP,
        splitCarbsPct: splitC,
        splitFatPct: splitF,
        mealsPerDay: meals,
      });
    }
  } catch {}

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!isSplitValid) {
      setErrorMsg(`Macro split must sum to 100%. Current sum: ${totalSplit}%`);
      return;
    }

    setSaving(true);
    const res = await saveTargets({
      kcalTarget: kcal,
      splitProteinPct: splitP,
      splitCarbsPct: splitC,
      splitFatPct: splitF,
      mealsPerDay: meals,
    });
    setSaving(false);

    if (res.ok) {
      setSuccessMsg("Target plan updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await exportMyData();
    setExporting(false);
    if (res.ok) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `macromeal-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    await deleteAccount();
    alert("Account data removed.");
    window.location.href = "/today";
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-28">
      <AppHeader title="MacroMeal" subtitle="Settings & Targets" />

      <main className="flex-1 flex flex-col relative w-full pt-16 max-w-md mx-auto px-margin gap-space-md">
        {successMsg && (
          <div className="p-3 rounded-xl bg-primary-fixed text-on-primary-fixed font-semibold text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container font-semibold text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Targets Configuration Form */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            <h3 className="font-headline-md text-base font-semibold text-on-surface">
              Daily Nutrition Targets
            </h3>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {/* Calories */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface-variant uppercase">
                  Daily Calories
                </label>
                <span className="font-bold text-sm text-on-surface tabular-nums">
                  {kcal.toLocaleString()} kcal
                </span>
              </div>
              <input
                type="range"
                min="1200"
                max="5000"
                step="50"
                value={kcal}
                onChange={(e) => setKcal(Number(e.target.value))}
                className="mt-2 w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Meals Per Day */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface-variant uppercase">
                  Meals Per Day
                </label>
                <span className="font-bold text-sm text-on-surface tabular-nums">{meals} meals</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 mt-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setMeals(num)}
                    className={`h-9 rounded-xl text-xs font-semibold transition-all ${
                      meals === num
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Macro Split % */}
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Macro Split</span>
                <span
                  className={`text-xs font-semibold ${
                    isSplitValid ? "text-primary" : "text-error font-bold"
                  }`}
                >
                  Sum: {totalSplit}% {isSplitValid ? "✓" : "(must equal 100%)"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-secondary">Protein %</label>
                  <input
                    type="number"
                    min="10"
                    max="70"
                    value={splitP}
                    onChange={(e) => setSplitP(Number(e.target.value))}
                    className="mt-1 w-full h-9 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-tertiary">Carbs %</label>
                  <input
                    type="number"
                    min="10"
                    max="70"
                    value={splitC}
                    onChange={(e) => setSplitC(Number(e.target.value))}
                    className="mt-1 w-full h-9 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#c4553d]">Fat %</label>
                  <input
                    type="number"
                    min="10"
                    max="70"
                    value={splitF}
                    onChange={(e) => setSplitF(Number(e.target.value))}
                    className="mt-1 w-full h-9 px-2 rounded-lg bg-surface border text-sm font-semibold tabular-nums"
                  />
                </div>
              </div>

              {/* Quick Split Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-on-surface-variant font-medium">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSplitP(30);
                    setSplitC(40);
                    setSplitF(30);
                  }}
                  className="px-2 py-0.5 rounded bg-surface border text-[10px] font-semibold hover:bg-surface-container"
                >
                  Balanced (30/40/30)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitP(40);
                    setSplitC(35);
                    setSplitF(25);
                  }}
                  className="px-2 py-0.5 rounded bg-surface border text-[10px] font-semibold hover:bg-surface-container"
                >
                  High Protein (40/35/25)
                </button>
              </div>
            </div>

            {/* Computed Per-Meal Target Preview */}
            {planPreview && (
              <div className="p-3 rounded-xl bg-surface-container-high/40 flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant">
                  Calculated Target Per Meal ({meals} meals)
                </span>
                <div className="flex items-center justify-between text-xs font-mono font-semibold">
                  <span className="text-secondary">{planPreview.perMeal.protein}g Protein</span>
                  <span className="text-tertiary">{planPreview.perMeal.carbs}g Carbs</span>
                  <span className="text-[#c4553d]">{planPreview.perMeal.fat}g Fat</span>
                  <span className="text-on-surface">≈ {planPreview.perMeal.kcal} kcal</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !isSplitValid}
              className="mt-1 w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? "Saving Targets..." : "Save Targets"}
            </button>
          </form>
        </section>

        {/* Security & Data Privacy Section */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface text-[20px]">
              shield_lock
            </span>
            <h3 className="font-headline-md text-base font-semibold text-on-surface">
              Privacy & Account
            </h3>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            MacroMeal isolates all personal nutrition data via Postgres Row Level Security. You
            retain full ownership of your logged data.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{exporting ? "Generating..." : "Export All My Data (JSON)"}</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-full h-10 rounded-xl bg-error-container text-on-error-container font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
              <span>{deleteConfirm ? "Click Again to Confirm Deletion" : "Delete My Account"}</span>
            </button>
          </div>
        </section>

        {/* Medical Disclaimer */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container text-[11px] text-on-surface-variant leading-relaxed">
          <p className="font-semibold text-on-surface mb-0.5">Medical Disclaimer</p>
          MacroMeal is an informational portion optimization and macro tracking tool. It is not
          intended to diagnose, treat, or replace professional medical or nutritional advice.
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
