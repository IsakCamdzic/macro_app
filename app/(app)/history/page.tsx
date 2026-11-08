"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { getHistory, exportMyData } from "@/lib/actions";

export default function HistoryPage() {
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [historyData, setHistoryData] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getHistory(range).then((res) => {
      if (res.ok) {
        setHistoryData(res.data);
        if (res.data.days.length > 0) {
          setSelectedDay(res.data.days[res.data.days.length - 1]);
        }
      }
    });
  }, [range]);

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
      a.download = `macromeal-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const avg = historyData?.average || { kcal: 2140, protein: 158, carbs: 215, fat: 68, targetPct: 97 };
  const days = historyData?.days || [];
  const targetKcal = historyData?.targetKcal || 2200;

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-24">
      <AppHeader
        title="MacroMeal"
        subtitle="History & Trends"
        rightAction={
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>{exporting ? "..." : "Export"}</span>
          </button>
        }
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 max-w-md mx-auto px-margin gap-space-md">
        {/* Date Range Tabs */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-surface-container">
            <button
              onClick={() => setRange("7d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                range === "7d"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setRange("30d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                range === "30d"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Last 30 Days
            </button>
          </div>
          <span className="text-xs text-on-surface-variant font-mono">
            Target: {targetKcal.toLocaleString()} kcal
          </span>
        </div>

        {/* 7-Day Average Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-space-md">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="font-label-caption text-label-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                7-Day Average
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-display-hero text-display-hero text-on-surface tabular-nums">
                  {avg.kcal.toLocaleString()}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant ml-1 font-medium">
                  kcal / day
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-caption text-label-caption flex items-center gap-1 shadow-sm font-semibold">
              <span className="material-symbols-outlined text-[14px]">done_all</span>
              <span className="tabular-nums">{avg.targetPct}% Target</span>
            </div>
          </div>

          {/* Macro Averages Row */}
          <div className="pt-2 bg-surface-container-low rounded-xl p-3 flex items-center justify-around border border-surface-container">
            <div className="flex flex-col items-center">
              <span className="font-label-caption text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                Protein Avg
              </span>
              <span className="font-data-metric-sm text-data-metric-sm text-on-surface tabular-nums mt-0.5">
                {avg.protein} <span className="font-normal text-xs text-on-surface-variant">g</span>
              </span>
            </div>
            <div className="h-6 w-px bg-surface-variant" />
            <div className="flex flex-col items-center">
              <span className="font-label-caption text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                Carbs Avg
              </span>
              <span className="font-data-metric-sm text-data-metric-sm text-on-surface tabular-nums mt-0.5">
                {avg.carbs} <span className="font-normal text-xs text-on-surface-variant">g</span>
              </span>
            </div>
            <div className="h-6 w-px bg-surface-variant" />
            <div className="flex flex-col items-center">
              <span className="font-label-caption text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c4553d]" />
                Fat Avg
              </span>
              <span className="font-data-metric-sm text-data-metric-sm text-on-surface tabular-nums mt-0.5">
                {avg.fat} <span className="font-normal text-xs text-on-surface-variant">g</span>
              </span>
            </div>
          </div>
        </section>

        {/* 7-Day Interactive Bar Chart Instrument */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">
                monitoring
              </span>
              <h3 className="font-headline-md text-[17px] font-semibold text-on-surface">
                Daily Balance
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-outline inline-block" />
              <span className="font-label-caption text-label-caption text-on-surface-variant tabular-nums">
                {targetKcal.toLocaleString()} kcal ref
              </span>
            </div>
          </div>

          {/* Selected day readout popover */}
          {selectedDay && (
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between animate-in fade-in">
              <span className="text-xs font-semibold text-on-surface">
                {selectedDay.formattedDate}
              </span>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-bold text-on-surface">{selectedDay.kcal} kcal</span>
                <span className="text-secondary font-semibold">{selectedDay.protein}P</span>
                <span className="text-tertiary font-semibold">{selectedDay.carbs}C</span>
                <span className="text-[#c4553d] font-semibold">{selectedDay.fat}F</span>
              </div>
            </div>
          )}

          {/* Bar Chart Canvas */}
          <div className="relative w-full h-44 pt-6 pb-2 flex flex-col justify-end">
            {/* Target Hairline */}
            <div className="absolute inset-x-0 top-8 flex items-center pointer-events-none z-10">
              <div className="w-full border-b border-dashed border-outline-variant" />
              <span className="absolute right-0 -top-3.5 bg-surface-container-lowest pl-1 font-label-caption text-[11px] text-on-surface-variant font-mono">
                {(targetKcal / 1000).toFixed(1)}k
              </span>
            </div>

            {/* Bars Grid */}
            <div className="grid grid-cols-7 gap-2 items-end h-32 w-full z-20">
              {days.map((day: any, idx: number) => {
                const heightPct = Math.min(100, Math.max(15, Math.round((day.kcal / (targetKcal * 1.25)) * 100)));
                const isSelected = selectedDay?.date === day.date;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className="group flex flex-col items-center h-full justify-end focus:outline-none"
                  >
                    <span
                      className={`font-label-caption text-[10px] tabular-nums mb-1 transition-opacity ${
                        isSelected ? "opacity-100 font-bold text-primary" : "opacity-0 group-hover:opacity-100 text-on-surface-variant"
                      }`}
                    >
                      {(day.kcal / 1000).toFixed(1)}k
                    </span>

                    <div
                      className={`w-full max-w-[32px] rounded-t-lg transition-all duration-200 ${
                        isSelected
                          ? "bg-primary shadow-sm ring-2 ring-primary/30"
                          : "bg-surface-variant hover:bg-secondary-fixed"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />

                    <span
                      className={`font-label-caption text-xs mt-2 font-medium ${
                        isSelected ? "text-primary font-bold" : "text-on-surface-variant"
                      }`}
                    >
                      {day.dayLabel.charAt(0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Daily Breakdown List */}
        <section className="flex flex-col gap-space-sm pt-1">
          <h3 className="font-headline-md text-[17px] font-semibold text-on-surface">
            Logged Days
          </h3>

          <div className="flex flex-col gap-space-sm">
            {days.map((day: any) => (
              <div
                key={day.date}
                className="p-space-md rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-on-surface">
                      {day.formattedDate}
                    </span>
                    {day.isToday && (
                      <span className="bg-primary-fixed text-on-primary-fixed text-[10px] px-1.5 py-0.2 rounded-full font-semibold">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant mt-0.5">
                    <span>{day.protein}g P</span>
                    <span>•</span>
                    <span>{day.carbs}g C</span>
                    <span>•</span>
                    <span>{day.fat}g F</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-sm text-on-surface tabular-nums">
                    {day.kcal} <span className="text-xs font-normal text-on-surface-variant">kcal</span>
                  </span>
                  <div className="text-[11px] font-semibold text-primary">
                    {day.pct}% target
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
