import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function HomeAssistantTokenHelp({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Connect Home Assistant</CardTitle>
        <p className="text-sm text-[var(--muted)]">
          Use a Home Assistant Long-Lived Access Token for the server-side HA_TOKEN setting.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[var(--foreground)]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <p className="font-medium">Before Quick Setup</p>
          <p className="mt-1 text-[var(--muted)]">
            HA_TOKEN connects this app to Home Assistant. The token issued by Quick Setup is a
            separate Gatekeeper token for callers.
          </p>
        </div>

        <ol className="space-y-2 pl-5">
          <li className="list-decimal">Open Home Assistant.</li>
          <li className="list-decimal">Go to your user profile.</li>
          <li className="list-decimal">Scroll to Long-Lived Access Tokens.</li>
          <li className="list-decimal">Create a token named ha-gatekeeper.</li>
          <li className="list-decimal">Copy it into HA_TOKEN in the server .env file.</li>
        </ol>

        <div className="rounded-md border border-[var(--primary-border)] bg-[var(--primary-soft)] p-3 font-mono text-xs text-[var(--primary)]">
          HA_TOKEN=your_home_assistant_token
        </div>

        <p className="text-xs text-[var(--muted)]">
          Keep this token private. Restart the server after changing .env, then retry loading
          entities.
        </p>
      </CardContent>
    </Card>
  );
}
