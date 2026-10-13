import type { ReactNode } from "react";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/utils";
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

  return (
    <div className="min-h-screen text-[var(--foreground)] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-[var(--surface)] p-3 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="border-b border-[var(--border)] bg-[var(--surface)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Icon name="shield" size={24} />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              ha-gatekeeper
            </h1>
            <p className="mt-0.5 text-[10px] tracking-wide text-[var(--muted)]">
              HOME ASSISTANT ACCESS
            </p>
          </div>
        </div>
        <div className="px-4 lg:mt-5">
          <p className="mb-3 hidden px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--muted)] lg:block">
            Workspace
          </p>
          <nav
            className="grid grid-cols-3 gap-1 pb-3 lg:grid-cols-1 lg:gap-2 lg:pb-0"
            aria-label="Primary navigation"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-current={activeTab === tab ? "page" : undefined}
                onClick={() => onTabChange(tab)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-medium transition-colors lg:justify-start lg:gap-3 lg:text-sm",
                  activeTab === tab
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon name={tabIcons[tab]} size={18} />
                {tab}
                {activeTab === tab ? (
                  <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[var(--primary)] lg:block" />
                ) : null}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto hidden p-5 lg:block">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <Icon name="home" className="mb-3 text-[var(--primary)]" />
            <p className="text-sm font-semibold">Your home. Your rules.</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Share just the access you choose. Keep everything else private.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-2 px-1 text-[10px] text-[var(--muted)]">
            <Icon name="lock" size={12} />
            Scoped access, by design
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-8 xl:px-10">
          <p className="hidden items-center gap-2 text-xs text-[var(--muted)] xl:flex">
            Access console<span className="mx-1 opacity-40">/</span>
            <span className="font-medium text-[var(--foreground)]">
              {activeTab}
            </span>
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:ml-auto">
            <Badge
              variant={
                haStatus === "connected"
                  ? "success"
                  : haStatus === "error"
                    ? "danger"
                    : "warning"
              }
              className="mr-1 py-2"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              {statusLabel}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Dark mode" : "Light mode"}
              title={theme === "light" ? "Dark mode" : "Light mode"}
              className="min-h-10 min-w-10 px-2"
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
            </Button>
            <span
              className="mx-1 h-5 w-px bg-[var(--border)]"
              aria-hidden="true"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="min-h-10"
            >
              <Icon name="logout" size={16} />
              {isLoggingOut ? "Logging out…" : "Log out"}
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1400px] p-5 outline-none sm:p-8 xl:p-10"
        >
          <div key={activeTab} className="page-enter">
            {children}
          </div>
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-5 text-[10px] text-[var(--muted)]">
            <span>ha-gatekeeper · Home Assistant access console</span>
            <span className="flex items-center gap-1.5">
              <Icon name="shield" size={12} />
              Limited access. Complete control.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
