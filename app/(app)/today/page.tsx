"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { getTodayPlan } from "@/lib/actions";

export default function TodayPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [planData, setPlanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const dateStr = currentDate.toISOString().split("T")[0];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getTodayPlan(dateStr)
      .then((res) => {
        if (isMounted && res.ok) {
          setPlanData(res.data);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dateStr]);

  const changeDay = (deltaDays: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + deltaDays);
    setCurrentDate(next);
  };

  const isToday = new Date().toDateString() === currentDate.toDateString();
  const formattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const progress = planData?.progress;
  const targetKcal = progress?.target?.kcal || 2200;
  const consumedKcal = progress?.consumed?.kcal || 0;
  const remainingKcal = Math.max(0, targetKcal - consumedKcal);
  const kcalPercent = Math.min(100, Math.round((consumedKcal / targetKcal) * 100));

  const targetP = progress?.target?.protein || 165;
  const consumedP = progress?.consumed?.protein || 0;
  const remainingP = Math.max(0, Number((targetP - consumedP).toFixed(1)));
  const pPercent = Math.min(100, Math.round((consumedP / targetP) * 100));

  const targetC = progress?.target?.carbs || 220;
  const consumedC = progress?.consumed?.carbs || 0;
  const remainingC = Math.max(0, Number((targetC - consumedC).toFixed(1)));
  const cPercent = Math.min(100, Math.round((consumedC / targetC) * 100));

  const targetF = progress?.target?.fat || 73;
  const consumedF = progress?.consumed?.fat || 0;
  const remainingF = Math.max(0, Number((targetF - consumedF).toFixed(1)));
  const fPercent = Math.min(100, Math.round((consumedF / targetF) * 100));

  const slots = planData?.slots || [
    { mealIndex: 1, name: "Breakfast", confirmed: false, target: { protein: 40, carbs: 55, fat: 18, kcal: 540 } },
    { mealIndex: 2, name: "Lunch", confirmed: false, target: { protein: 50, carbs: 52.5, fat: 25, kcal: 635 } },
    { mealIndex: 3, name: "Dinner", confirmed: false, target: { protein: 45, carbs: 55, fat: 18, kcal: 560 } },
    { mealIndex: 4, name: "Snack", confirmed: false, target: { protein: 30, carbs: 40, fat: 12, kcal: 388 } },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-24">
      <AppHeader
        title="MacroMeal"
        rightAction={
          <div className="flex items-center gap-space-sm">
            <span className="font-label-caption text-label-caption text-on-surface-variant uppercase tracking-wider">
              Today
            </span>
            <Link
              href="/settings"
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </Link>
          </div>
        }
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 max-w-md mx-auto px-margin">
        {/* Date Selector */}
        <div className="flex items-center justify-between py-space-sm">
          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => changeDay(-1)}
              aria-label="Previous day"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors active:scale-95 text-on-surface"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <div className="flex items-center gap-space-xs px-space-xs">
              <span className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
                {formattedDate}
              </span>
              {isToday && (
                <span className="bg-primary-fixed text-on-primary-fixed font-label-caption text-label-caption px-2 py-0.5 rounded-full font-semibold">
                  Today
                </span>
              )}
            </div>
            <button
              onClick={() => changeDay(1)}
              aria-label="Next day"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors active:scale-95 text-on-surface"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          <Link
            href="/settings"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Adjust Targets"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </Link>
        </div>

        {/* Energy Consumed Card */}
        <section className="mt-space-sm bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-high">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="font-label-caption text-label-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                Energy Consumed
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-display-hero text-display-hero text-on-surface tabular-nums">
                  {consumedKcal.toLocaleString()}
                </span>
                <span className="font-headline-md text-headline-md text-on-surface-variant tabular-nums">
                  / {targetKcal.toLocaleString()}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant ml-1 font-medium">
                  kcal
                </span>
              </div>
            </div>

            <div className="bg-surface-container-low px-2.5 py-1 rounded-full flex items-center gap-1 border border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-[14px]">flag</span>
              <span className="font-label-caption text-label-caption text-on-surface-variant tabular-nums font-medium">
                {remainingKcal} left
              </span>
            </div>
          </div>

          {/* Calorie Progress Track */}
          <div className="relative w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${kcalPercent}%` }}
            />
            <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-surface-container-lowest opacity-70" />
            <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-surface-container-lowest opacity-70" />
            <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-surface-container-lowest opacity-70" />
          </div>

          {/* 3 Macro Instrument Split Cards */}
          <div className="grid grid-cols-3 gap-gutter pt-space-xs">
            {/* Protein */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-container-low border border-surface-container">
              <div className="flex items-center justify-between">
                <span className="font-label-caption text-label-caption text-on-surface-variant font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  Protein
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="font-data-metric-sm text-data-metric-sm text-on-surface tabular-nums">
                  {consumedP} <span className="text-[11px] font-normal text-on-surface-variant">/ {targetP}g</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-300"
                  style={{ width: `${pPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-on-surface-variant font-mono text-right">
                {remainingP}g left
              </span>
            </div>

            {/* Carbs */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-container-low border border-surface-container">
              <div className="flex items-center justify-between">
                <span className="font-label-caption text-label-caption text-on-surface-variant font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-tertiary" />
                  Carbs
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="font-data-metric-sm text-data-metric-sm text-on-surface tabular-nums">
                  {consumedC} <span className="text-[11px] font-normal text-on-surface-variant">/ {targetC}g</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-tertiary rounded-full transition-all duration-300"
                  style={{ width: `${cPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-on-surface-variant font-mono text-right">
                {remainingC}g left
              </span>
            </div>

            {/* Fat */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-container-low border border-surface-container">
              <div className="flex items-center justify-between">
                <span className="font-label-caption text-label-caption text-on-surface-variant font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#c4553d]" />
                  Fat
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="font-data-metric-sm text-data-metric-sm text-on-surface tabular-nums">
                  {consumedF} <span className="text-[11px] font-normal text-on-surface-variant">/ {targetF}g</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#c4553d] rounded-full transition-all duration-300"
                  style={{ width: `${fPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-on-surface-variant font-mono text-right">
                {remainingF}g left
              </span>
            </div>
          </div>
        </section>

        {/* Planned Meals Section */}
        <div className="mt-space-lg flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
              Planned Meals
            </h2>
            <span className="text-xs bg-surface-container-high text-on-surface-variant font-medium px-2 py-0.5 rounded-full">
              {slots.filter((s: any) => s.confirmed).length} / {slots.length} logged
            </span>
          </div>
        </div>

        {/* Meal Slots List */}
        <div className="mt-space-sm flex flex-col gap-space-md">
          {slots.map((slot: any) => {
            const isConfirmed = slot.confirmed;
            return (
              <div
                key={slot.mealIndex}
                className={`p-space-lg rounded-2xl border transition-all ${
                  isConfirmed
                    ? "bg-surface-container-lowest border-primary/20 shadow-sm"
                    : "bg-surface-container-lowest border-surface-container-high hover:border-surface-container-highest"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm ${
                        isConfirmed
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-on-surface"
                      }`}
                    >
                      {isConfirmed ? (
                        <span className="material-symbols-outlined text-[20px]">check</span>
                      ) : (
                        slot.mealIndex
                      )}
                    </div>
                    <div>
                      <h3 className="font-headline-md text-[17px] font-semibold text-on-surface">
                        {slot.name}
                      </h3>
                      <p className="font-label-caption text-label-caption text-on-surface-variant mt-0.5">
                        Target: {slot.target.protein}P · {slot.target.carbs}C · {slot.target.fat}F ({slot.target.kcal} kcal)
                      </p>
                    </div>
                  </div>

                  {isConfirmed && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[11px] font-semibold">
                      Confirmed
                    </span>
                  )}
                </div>

                {/* Items preview if confirmed */}
                {isConfirmed && slot.items && slot.items.length > 0 && (
                  <div className="mt-space-sm pt-space-xs border-t border-surface-container-high flex flex-wrap gap-1.5">
                    {slot.items.map((item: any, i: number) => (
                      <span
                        key={i}
                        className="bg-surface-container text-on-surface text-[12px] px-2.5 py-1 rounded-lg font-medium"
                      >
                        {item.food_name || item.name} ({Math.round(item.grams)}g)
                      </span>
                    ))}
                  </div>
                )}

                {/* Action button */}
                <div className="mt-space-md flex items-center justify-end">
                  <Link
                    href={`/meal/${slot.mealIndex}?date=${dateStr}&p=${slot.target.protein}&c=${slot.target.carbs}&f=${slot.target.fat}&name=${encodeURIComponent(
                      slot.name
                    )}`}
                    className={`inline-flex items-center gap-1.5 px-space-md py-2 rounded-xl text-sm font-semibold transition-transform active:scale-95 ${
                      isConfirmed
                        ? "bg-surface-container text-on-surface hover:bg-surface-container-high"
                        : "bg-primary text-on-primary shadow-sm hover:opacity-90"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isConfirmed ? "edit" : "restaurant_menu"}
                    </span>
                    <span>{isConfirmed ? "Edit Meal" : "Solve & Log Meal"}</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
