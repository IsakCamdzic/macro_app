import Link from "next/link";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  rightAction?: React.ReactNode;
}

export function AppHeader({
  title = "MacroMeal",
  subtitle,
  showBack = false,
  backHref = "/today",
  rightAction,
}: AppHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe">
      <div className="max-w-md mx-auto h-14 px-margin flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          {showBack ? (
            <Link
              href={backHref}
              aria-label="Go Back"
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors -ml-2"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </Link>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary font-bold shadow-sm">
              <span className="material-symbols-outlined text-[20px] text-white">scale</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md tracking-tight text-on-surface font-semibold leading-tight">
              {title}
            </span>
            {subtitle && (
              <span className="text-[11px] text-on-surface-variant font-medium leading-none">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {rightAction ? (
          rightAction
        ) : (
          <Link
            href="/settings"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm"
          >
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </Link>
        )}
      </div>
    </header>
  );
}
