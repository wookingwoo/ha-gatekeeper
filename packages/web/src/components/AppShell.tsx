import type { ReactNode } from "react";
import { useTheme } from "../lib/theme";
import { BrandMark } from "./BrandMark";
import { Icon, type IconName } from "./Icon";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export const tabs = ["Quick Start", "Tokens", "Activity"] as const;
export type Tab = (typeof tabs)[number];
const tabIcons: Record<Tab, IconName> = {
  "Quick Start": "spark",
  Tokens: "key",
  Activity: "activity",
};

type AppShellProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
  haStatus: "loading" | "connected" | "error";
  children: ReactNode;
};

export function AppShell({
  activeTab,
  onTabChange,
  onLogout,
  isLoggingOut,
  haStatus,
  children,
}: AppShellProps) {
  const { theme, toggleTheme } = useTheme();
  const statusLabel =
    haStatus === "connected"
      ? "Home Assistant connected"
      : haStatus === "error"
        ? "Home Assistant unavailable"
        : "Checking Home Assistant";
  const themeLabel = theme === "light" ? "Dark mode" : "Light mode";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-[var(--surface)] p-3 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="gate-rail lg:sticky lg:top-3 lg:m-3 lg:flex lg:h-[calc(100dvh-24px)] lg:flex-col lg:rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 lg:px-5 lg:py-7">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9 shrink-0 text-[#d8ec9c]" />
            <div>
              <h1 className="text-[14px] font-bold tracking-tight">
                ha-gatekeeper
              </h1>
              <p className="mt-1 text-[9px] uppercase tracking-[.18em] text-[#b5bcac]">
                Scoped access
              </p>
            </div>
          </div>
          <div className="flex gap-1 lg:hidden">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg text-[#d8decf] hover:bg-[#33432b]"
              onClick={toggleTheme}
              aria-label={themeLabel}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg text-[#d8decf] hover:bg-[#33432b] disabled:opacity-50"
              onClick={onLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Logging out…" : "Log out"}
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
        <p className="mb-4 mt-7 hidden px-6 text-[9px] font-semibold uppercase tracking-[.18em] text-[#96a08b] lg:block">
          Control room
        </p>
        <nav
          aria-label="Primary navigation"
          className="gate-rail fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-[#46533d] pb-[env(safe-area-inset-bottom)] lg:static lg:mx-3 lg:grid-cols-1 lg:gap-1.5 lg:border-0 lg:pb-0"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className="gate-nav"
              aria-current={activeTab === tab ? "page" : undefined}
              onClick={() => onTabChange(tab)}
            >
              <Icon name={tabIcons[tab]} size={18} />
              <span>{tab}</span>
              <span
                aria-hidden="true"
                className="ml-auto hidden text-[9px] opacity-50 lg:block"
              >
                0{index + 1}
              </span>
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-6 pb-7 lg:block">
          <div
            className="relative mb-6 h-28 overflow-hidden border-b border-[#46533d]"
            aria-hidden="true"
          >
            <div className="absolute bottom-0 left-1/2 h-20 w-16 -translate-x-1/2 rounded-t-full border border-b-0 border-[#8fa469]" />
            <div className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 rounded-t-full border border-b-0 border-[#61734e]" />
            <div className="absolute bottom-0 left-1/2 h-28 w-32 -translate-x-1/2 rounded-t-full border border-b-0 border-[#44543a]" />
            <div className="absolute bottom-0 left-1/2 h-14 w-8 -translate-x-1/2 rounded-t-full bg-[#d8ec9c]" />
          </div>
          <p className="text-sm font-semibold leading-relaxed text-[#edf0e3]">
            A little access.
            <br />A lot of peace of mind.
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-[#a7b09d]">
            Your credentials stay private.
            <br />
            Your permissions stay precise.
          </p>
          <p className="mt-7 flex items-center gap-2 text-[9px] uppercase tracking-[.14em] text-[#b8c4a8]">
            <Icon name="lock" size={12} />
            Private by design
          </p>
        </div>
      </aside>
      <div className="min-w-0 pb-32 lg:pb-0">
        <header className="mx-5 flex min-h-12 items-center justify-between gap-2 border-b border-[var(--border)] py-2 lg:mx-8 lg:min-h-[80px] xl:mx-12">
          <p className="hidden items-center gap-3 text-[11px] text-[var(--muted)] lg:flex">
            <Icon name="home" size={14} />
            <span>Workspace</span>
            <span className="opacity-40">/</span>
            <span className="text-[var(--foreground)]">{activeTab}</span>
          </p>
          <div className="flex items-center gap-3 lg:ml-auto">
            <Badge
              variant={
                haStatus === "connected"
                  ? "success"
                  : haStatus === "error"
                    ? "danger"
                    : "warning"
              }
              className="border-0 bg-transparent px-0 text-[10px]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              {statusLabel}
            </Badge>
            <div className="hidden items-center gap-2 border-l border-[var(--border)] pl-3 lg:flex">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleTheme}
                aria-label={themeLabel}
                title={themeLabel}
                className="min-h-10 min-w-10 px-2"
              >
                <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onLogout}
                disabled={isLoggingOut}
              >
                <Icon name="logout" size={15} />
                {isLoggingOut ? "Logging out…" : "Log out"}
              </Button>
            </div>
          </div>
          <span className="text-[9px] uppercase tracking-[.14em] text-[var(--muted)] lg:hidden">
            Access console
          </span>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1440px] px-5 py-6 outline-none lg:px-8 lg:py-9 xl:px-12"
        >
          <div key={activeTab} className="page-enter">
            {children}
          </div>
          <footer className="mt-7 hidden flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-[9px] text-[var(--muted)] lg:flex">
            <span>Home Assistant access, on your terms.</span>
            <span className="flex items-center gap-1.5 uppercase tracking-[.12em]">
              <BrandMark className="h-4 w-4" />
              Gatekeeper
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
