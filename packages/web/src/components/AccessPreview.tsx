import type { QuickSetupUseCase } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const serviceLabels: Record<QuickSetupUseCase, string[]> = {
  control_lights: ["light.turn_on", "light.turn_off", "light.toggle"],
  control_switches: ["switch.turn_on", "switch.turn_off"],
  run_scripts: ["script.turn_on"]
};

const useCaseLabels: Record<QuickSetupUseCase, string> = {
  control_lights: "Control lights",
  control_switches: "Control switches",
  run_scripts: "Run scripts"
};

export function AccessPreview({
  useCase,
  targetCount,
  tokenName
}: {
  useCase: QuickSetupUseCase | "";
  targetCount: number;
  tokenName: string;
}) {
  const services = useCase ? serviceLabels[useCase] : [];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Access preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-300">
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs uppercase text-slate-500">Use case</p>
          <p>{useCase ? useCaseLabels[useCase] : "Choose a use case"}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs uppercase text-slate-500">Targets</p>
          <p>{targetCount} selected</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs uppercase text-slate-500">Services</p>
          <p>{services.length > 0 ? services.join(", ") : "No services selected"}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs uppercase text-slate-500">Token name</p>
          <p>{tokenName || "Generated during setup"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
