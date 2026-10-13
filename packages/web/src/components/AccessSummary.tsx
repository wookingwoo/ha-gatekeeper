import type { PermissionGroup } from "../lib/permissionGroups";
import { buildAccessSummary, groupsAreComplete } from "../lib/permissionGroups";
import { Icon } from "./Icon";

export function AccessSummary({ groups, tokenName }: {
  groups: PermissionGroup[];
  tokenName: string;
}) {
  const summary = buildAccessSummary(groups);
  const complete = groupsAreComplete(groups) && Boolean(tokenName.trim());
  return (
    <aside className="hidden self-start xl:sticky xl:top-6 xl:block">
      <div className="studio-panel p-6">
        <h3 className="text-lg font-semibold">Access summary</h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          Review before issuing. Tokens are shown once.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { value: summary.domainCount, label: "Domains" },
            { value: summary.serviceCount, label: "Services" },
            { value: summary.entityCount, label: "Entities" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-4">
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <p className="field-label">Token name</p>
          <p className="mt-2 break-words text-sm [overflow-wrap:anywhere]">
            {tokenName.trim() || "Name your key"}
          </p>
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-[var(--primary)]">
          <Icon name={complete ? "check" : "layers"} size={14} />
          {complete ? "Ready for your review" : "Complete your permission groups"}
        </p>
        <p className="mt-5 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-xs leading-relaxed text-[var(--warning)]">
          Area, device, floor, and label targets are blocked before requests reach Home Assistant.
        </p>
      </div>
      <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
        Your Home Assistant credentials stay on the server. Only selected services and entities are shared.
      </p>
    </aside>
  );
}
