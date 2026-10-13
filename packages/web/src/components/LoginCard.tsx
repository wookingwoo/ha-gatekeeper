import type { ApiError } from "../api";
import { useTheme } from "../lib/theme";
import { Icon } from "./Icon";
import { ErrorNotice } from "./Feedback";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function LoginCard({
  password, onPasswordChange, onSubmit, isSubmitting, error,
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: ApiError | null;
}) {
  const { theme, toggleTheme } = useTheme();
  const errorMessage = !error ? null : error.code === "rate_limited"
    ? "Too many login attempts. Wait a moment and try again."
    : "Login failed. Check your password and try again.";
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-20">
      <Button variant="secondary" className="absolute right-5 top-5"
        onClick={toggleTheme} aria-label={theme === "light" ? "Dark mode" : "Light mode"}>
        <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
        {theme === "light" ? "Dark mode" : "Light mode"}
      </Button>
      <section className="studio-panel w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold">ha-gatekeeper</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Home Assistant access console</p>
        <div className="mt-6 border-t border-[var(--border)] pt-6">
          <h2 className="text-2xl font-semibold">Welcome home.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Log in to manage your access tokens.</p>
        </div>
        <form className="mt-6 space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (password && !isSubmitting) onSubmit();
        }}>
          <div className="space-y-2">
            <label htmlFor="admin-password" className="field-label">Admin password</label>
            <Input id="admin-password" type="password" autoComplete="current-password"
              placeholder="Enter your admin password" value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required disabled={isSubmitting} aria-invalid={Boolean(error)}
              aria-describedby={errorMessage ? "login-error" : undefined} />
          </div>
          {errorMessage ? (
            <ErrorNotice><span id="login-error">{errorMessage}</span></ErrorNotice>
          ) : null}
          <Button className="w-full" type="submit" disabled={!password || isSubmitting}>
            {isSubmitting ? <><span className="loading-spinner" />Logging in…</> : <>Log in<Icon name="arrow" size={16} /></>}
          </Button>
        </form>
        <p className="mt-6 flex items-start gap-2 border-t border-[var(--border)] pt-5 text-xs leading-relaxed text-[var(--muted)]">
          <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
          Your Home Assistant token stays on the server. Only scoped Gatekeeper tokens are shared.
        </p>
      </section>
    </div>
  );
}
