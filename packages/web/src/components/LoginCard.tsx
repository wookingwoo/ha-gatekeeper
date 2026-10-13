import type { ApiError } from "../api";
import { useTheme } from "../lib/theme";
import { BrandMark } from "./BrandMark";
import { Icon } from "./Icon";
import { ErrorNotice } from "./Feedback";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function LoginCard({
  password,
  onPasswordChange,
  onSubmit,
  isSubmitting,
  error,
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: ApiError | null;
}) {
  const { theme, toggleTheme } = useTheme();
  const errorMessage = !error
    ? null
    : error.code === "rate_limited"
      ? "Too many login attempts. Wait a moment and try again."
      : "Login failed. Check your password and try again.";
  return (
    <div className="grid min-h-screen lg:grid-cols-[.95fr_1.05fr]">
      <section className="gate-rail relative m-3 hidden min-h-[780px] flex-col justify-between overflow-hidden rounded-2xl p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10 text-[#d8ec9c]" />
          <h1 className="text-lg font-bold tracking-tight">ha-gatekeeper</h1>
        </div>
        <div className="relative z-10 my-10 max-w-md">
          <p className="mb-6 text-[10px] uppercase tracking-[.22em] text-[#bac7a6]">
            Home Assistant, on your terms
          </p>
          <h2 className="text-5xl font-medium leading-[1.06] tracking-[-.055em] xl:text-[64px]">
            Give access.
            <br />
            <span className="text-[#d8ec9c]">Keep control.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-[#bec8b2]">
            A key for every person and agent.
            <br />
            Only the doors you choose to open.
          </p>
          <div
            aria-hidden="true"
            className="relative mt-12 grid h-[300px] place-items-center overflow-hidden"
          >
            <div className="absolute bottom-5 h-[240px] w-[180px] rounded-t-full border border-[#809f59]" />
            <div className="absolute bottom-5 h-[270px] w-[240px] rounded-t-full border border-[#536b40]" />
            <div className="absolute bottom-5 h-[300px] w-[300px] rounded-t-full border border-[#3e5032]" />
            <div className="absolute bottom-5 left-0 right-0 h-px bg-[#809f59]" />
            <div className="absolute bottom-5 grid h-[150px] w-[100px] place-items-center rounded-t-full bg-[#d8ec9c] text-[#293824]">
              <BrandMark className="h-14 w-14" />
            </div>
            <span className="absolute bottom-20 left-0 rounded-lg border border-[#657852] bg-[#2b392b] px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[#dce5cb]">
              Precise permissions
            </span>
            <span className="absolute right-0 top-24 rounded-lg border border-[#657852] bg-[#2b392b] px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[#dce5cb]">
              Private credentials
            </span>
          </div>
        </div>
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-[#bec8b2]">
          <Icon name="lock" size={13} />
          Built around your boundaries
        </p>
      </section>
      <section className="relative flex flex-col justify-center p-6 sm:p-12">
        <Button
          variant="ghost"
          className="absolute right-5 top-5 min-h-11 min-w-11 px-3"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Dark mode" : "Light mode"}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
        </Button>
        <div className="mx-auto w-full max-w-sm py-12">
          <BrandMark className="mb-6 h-14 w-14 text-[var(--primary)]" />
          <h1 className="mb-6 text-sm font-bold lg:hidden">ha-gatekeeper</h1>
          <p className="eyebrow mb-4">Your private workspace</p>
          <h2 className="text-[38px] font-semibold leading-tight tracking-[-.055em]">
            Welcome home.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
            A little access. A lot of peace of mind.
            <br />
            Log in to manage the keys to your home.
          </p>
          <form
            className="mt-9 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (password && !isSubmitting) onSubmit();
            }}
          >
            <div className="space-y-2.5">
              <label htmlFor="admin-password" className="field-label">
                Admin password
              </label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your admin password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(error)}
                aria-describedby={errorMessage ? "login-error" : undefined}
              />
            </div>
            {errorMessage ? (
              <ErrorNotice>
                <span id="login-error">{errorMessage}</span>
              </ErrorNotice>
            ) : null}
            <Button
              className="w-full"
              type="submit"
              disabled={!password || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner" />
                  Logging in…
                </>
              ) : (
                <>
                  Log in
                  <Icon name="arrow" size={16} />
                </>
              )}
            </Button>
          </form>
          <div className="mt-8 flex items-start gap-2.5 border-t border-[var(--border)] pt-5 text-[11px] leading-relaxed text-[var(--muted)]">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
            <p>
              Your Home Assistant token stays on the server.
              <br />
              Only scoped Gatekeeper tokens are shared.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
