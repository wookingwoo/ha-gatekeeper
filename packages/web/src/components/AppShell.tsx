import type { ReactNode } from "react";
import { useTheme } from "../lib/theme";
import { Icon } from "./Icon";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export const tabs = ["Quick Start", "Tokens", "Activity"] as const;
export type Tab = (typeof tabs)[number];

type AppShellProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
  haStatus: "loading" | "connected" | "error";
  children: ReactNode;
};

export function AppShell({
  activeTab, onTabChange, onLogout, isLoggingOut, haStatus, children,
}: AppShellProps) {
  const { theme, toggleTheme } = useTheme();
  const statusLabel = haStatus === "connected"
    ? "Home Assistant connected"
    : haStatus === "error" ? "Home Assistant unavailable" : "Checking Home Assistant";
  const themeLabel = theme === "light" ? "Dark mode" : "Light mode";

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <a href="#main-content"
        className="sr-only z-50 rounded-lg bg-[var(--surface)] p-3 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 shadow-sm sm:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto min-w-0 xl:mr-2">
              <h1 className="text-lg font-semibold">ha-gatekeeper</h1>
              <p className="text-[11px] text-[var(--muted)] sm:text-xs">Home Assistant access console</p>
            </div>
            <nav aria-label="Primary navigation"
              className="order-3 grid w-full grid-cols-3 gap-2 xl:order-none xl:flex xl:w-auto">
              {tabs.map((tab) => (
                <Button key={tab} size="sm"
                  variant={activeTab === tab ? "default" : "ghost"}
                  className="min-w-0 px-2 text-sm sm:px-3"
                  aria-current={activeTab === tab ? "page" : undefined}
                  onClick={() => onTabChange(tab)}>
                  {tab}
                </Button>
              ))}
            </nav>
            <div className="order-4 w-full xl:order-none xl:ml-auto xl:w-auto">
              <Badge variant={haStatus === "connected" ? "success" : haStatus === "error" ? "danger" : "warning"}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                {statusLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={toggleTheme}
                aria-label={themeLabel} title={themeLabel} className="min-w-10 px-2 sm:px-3">
                <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
                <span className="hidden sm:inline">{themeLabel}</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={onLogout}
                disabled={isLoggingOut} aria-label={isLoggingOut ? "Logging out…" : "Log out"}
                className="min-w-10 px-2 sm:px-3">
                <Icon name="logout" size={16} />
                <span className="hidden sm:inline">{isLoggingOut ? "Logging out…" : "Log out"}</span>
              </Button>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 pb-20 outline-none sm:pb-0">
          <div key={activeTab} className="page-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
