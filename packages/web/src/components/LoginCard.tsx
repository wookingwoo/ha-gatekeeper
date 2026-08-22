import type { ApiError } from "../api";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

function loginErrorMessage(error: ApiError | null): string | null {
  if (!error) {
    return null;
  }
  if (error.code === "rate_limited") {
    return "Too many login attempts. Wait a moment and try again.";
  }
  return "Login failed. Check your password.";
}

export function LoginCard({
  password,
  onPasswordChange,
  onSubmit,
  isSubmitting,
  error
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: ApiError | null;
}) {
  const errorMessage = loginErrorMessage(error);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">ha-gatekeeper</CardTitle>
        <p className="text-sm text-[var(--muted)]">Session-based admin console login</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="admin-password" className="text-xs font-semibold uppercase text-[var(--muted)]">
            Admin password
          </label>
          <Input
            id="admin-password"
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSubmit();
              }
            }}
          />
        </div>
        <Button className="w-full" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </Button>
        {errorMessage ? (
          <p className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
