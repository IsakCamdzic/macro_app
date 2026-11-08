"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/today", label: "Today", icon: "calendar_today" },
    { href: "/history", label: "History", icon: "monitoring" },
    { href: "/foods", label: "Foods", icon: "restaurant" },
    { href: "/settings", label: "Settings", icon: "tune" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-surface-container-high pb-safe">
      <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[24px] ${
                  isActive ? "text-primary" : ""
                }`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className="text-[11px] font-medium tracking-tight mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
