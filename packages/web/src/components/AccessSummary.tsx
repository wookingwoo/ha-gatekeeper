import type { PermissionGroup } from "../lib/permissionGroups";
import { buildAccessSummary } from "../lib/permissionGroups";
import { Icon } from "./Icon";
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
  onSubmit,
}: AccessSummaryProps) {
  const summary = buildAccessSummary(groups);
  return (
    <Card className="self-start border-[var(--primary-border)] xl:sticky xl:top-6">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <div className="icon-tile">
            <Icon name="shield" />
          </div>
          <span className="eyebrow">Your access, at a glance</span>
        </div>
        <CardTitle>Access summary</CardTitle>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          A small key. Only the doors you choose.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 divide-x divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-4 text-center">
          {[
            { value: summary.domainCount, label: "Domains" },
            { value: summary.serviceCount, label: "Services" },
            { value: summary.entityCount, label: "Entities" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-semibold tracking-tight">
                {stat.value}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        <div className="text-sm">
          <p className="mb-3 text-xs font-semibold">This token can</p>
          {summary.lines.length ? (
            <ul className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
              {summary.lines.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Icon
                    name="check"
                    size={15}
                    className="mt-0.5 shrink-0 text-[var(--primary)]"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Select services and entities to build your access rules.
            </p>
          )}
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-[var(--surface-muted)] p-3.5 text-[11px] leading-relaxed text-[var(--muted)]">
          <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
          <p>
            Area, device, floor, and label targets are blocked before requests
            reach Home Assistant.
          </p>
        </div>
        <div className="space-y-3 border-t border-[var(--border)] pt-5">
          <Button
            className="w-full"
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner" />
                Issuing token…
              </>
            ) : (
              <>
                {submitLabel}
                <Icon name="arrow" size={16} />
              </>
            )}
          </Button>
          <p className="text-center text-[10px] leading-relaxed text-[var(--muted)]">
            {canSubmit
              ? "Ready to issue. Copy your token when it appears."
              : "Name your token and complete every permission group."}
            <br />
            Tokens are shown only once.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
