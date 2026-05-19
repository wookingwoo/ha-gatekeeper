import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function HomeAssistantTokenHelp() {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Connect Home Assistant</CardTitle>
        <p className="text-sm text-slate-400">
          Use a Home Assistant Long-Lived Access Token for the server-side HA_TOKEN setting.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-300">
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <p className="font-medium text-slate-100">Before Quick Setup</p>
          <p className="mt-1 text-slate-400">
            HA_TOKEN connects this app to Home Assistant. The token issued by Quick Setup is a
            separate Gatekeeper token for callers.
          </p>
        </div>

        <ol className="space-y-2 pl-5 text-slate-300">
          <li className="list-decimal">Open Home Assistant.</li>
          <li className="list-decimal">Go to your user profile.</li>
          <li className="list-decimal">Scroll to Long-Lived Access Tokens.</li>
          <li className="list-decimal">Create a token named ha-gatekeeper.</li>
          <li className="list-decimal">Copy it into HA_TOKEN in the server .env file.</li>
        </ol>

        <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs text-emerald-200">
          HA_TOKEN=your_home_assistant_token
        </div>

        <p className="text-xs text-slate-500">
          Keep this token private. Restart the server after changing .env, then retry loading
          entities.
        </p>
      </CardContent>
    </Card>
  );
}
