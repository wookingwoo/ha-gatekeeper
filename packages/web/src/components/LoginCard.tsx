import type { ApiError } from "../api";
import { useTheme } from "../lib/theme";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#183b2c] p-12 text-white lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <Icon name="shield" size={28} />
          <h1 className="text-lg font-semibold tracking-tight">
            ha-gatekeeper
          </h1>
        </div>
        <div className="relative my-16 max-w-lg">
          <p className="mb-6 text-xs font-medium uppercase tracking-[.2em] text-[#a8cfb6]">
            A thoughtful way to share your home
          </p>
          <h2 className="text-5xl font-medium leading-[1.12] tracking-[-.045em] xl:text-6xl">
            A little access.
            <br />
            <span className="text-[#b6dfaa]">
              A lot of peace
              <br />
              of mind.
            </span>
          </h2>
          <p className="mt-7 max-w-sm text-base leading-relaxed text-[#b9cec0]">
            Give your people and agents the access they need. Keep your Home
            Assistant credentials safely yours.
          </p>
          <div
            aria-hidden="true"
            className="relative mt-12 flex h-44 items-center justify-center"
          >
            <div className="absolute h-44 w-44 rounded-full border border-white/10" />
            <div className="absolute h-32 w-32 rounded-full border border-white/15" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-[#b6dfaa]">
              <Icon name="shield" size={42} />
            </div>
            <div className="absolute left-6 flex items-center gap-2 rounded-xl border border-white/15 bg-[#214b37] px-4 py-3 text-xs">
              <Icon name="home" size={16} />
              Your home
            </div>
            <div className="absolute right-0 flex items-center gap-2 rounded-xl border border-white/15 bg-[#214b37] px-4 py-3 text-xs">
              <Icon name="key" size={16} />
              Scoped access
            </div>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-[#b9cec0]">
          <Icon name="lock" size={14} />
          Private credentials. Precise permissions.
        </p>
      </section>
      <section className="relative flex flex-col justify-center p-6 sm:p-12">
        <Button
          variant="ghost"
          className="absolute right-5 top-5 min-h-11 min-w-11 px-3"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Dark mode" : "Light mode"}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} />
        </Button>
        <div className="mx-auto w-full max-w-sm py-12">
          <div className="icon-tile mb-8 h-14 w-14 rounded-2xl">
            <Icon name="shield" size={28} />
          </div>
          <h1 className="mb-6 text-base font-semibold lg:hidden">
            ha-gatekeeper
          </h1>
          <p className="eyebrow mb-3">Your access workspace</p>
          <h2 className="text-3xl font-semibold tracking-[-.04em]">
            Welcome home.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Log in to manage who can access your Home Assistant.
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
                  <Icon name="arrow" size={17} />
                </>
              )}
            </Button>
          </form>
          <div className="mt-8 flex items-start gap-2.5 border-t border-[var(--border)] pt-5 text-xs leading-relaxed text-[var(--muted)]">
            <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
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
