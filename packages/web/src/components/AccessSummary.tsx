import type { PermissionGroup } from "../lib/permissionGroups";
import { buildAccessSummary } from "../lib/permissionGroups";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type AccessSummaryProps = {
  groups: PermissionGroup[];
  canSubmit: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
};

export function AccessSummary({
  groups,
  canSubmit,
  isSubmitting,
  submitLabel,
  onSubmit
}: AccessSummaryProps) {
  const summary = buildAccessSummary(groups);
  const lines =
    summary.lines.length > 0
      ? summary.lines
      : ["Select at least one service target or state read before issuing a token."];

  return (
    <Card className="sticky top-5">
      <CardHeader className="p-5 pb-3">
        <CardTitle>Access summary</CardTitle>
        <p className="text-sm text-[var(--muted)]">Review before issuing. Tokens are shown once.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <p className="text-lg font-semibold">{summary.domainCount}</p>
            <p className="text-xs text-[var(--muted)]">Domains</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <p className="text-lg font-semibold">{summary.serviceCount}</p>
            <p className="text-xs text-[var(--muted)]">Services</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <p className="text-lg font-semibold">{summary.entityCount}</p>
            <p className="text-xs text-[var(--muted)]">Entities</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium">Token can</p>
          <ul className="space-y-2 text-[var(--muted)]">
            {lines.map((line) => (
              <li key={line} className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
          Area, device, floor, and label targets are blocked before requests reach Home Assistant.
        </div>

        <Button className="w-full" disabled={!canSubmit || isSubmitting} onClick={onSubmit}>
          {isSubmitting ? "Working..." : submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
