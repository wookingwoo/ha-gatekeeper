import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export function LoginCard({
  password,
  onPasswordChange,
  onSubmit,
  isSubmitting,
  hasError
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  hasError: boolean;
}) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-2xl">ha-gatekeeper admin</CardTitle>
        <p className="text-sm text-slate-400">Session-based admin console login</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        <Button className="w-full" onClick={onSubmit} disabled={isSubmitting}>
          Log in
        </Button>
        {hasError ? (
          <p className="text-sm text-rose-300">Login failed. Check your password.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
