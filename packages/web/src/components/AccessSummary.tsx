import type { PermissionGroup } from "../lib/permissionGroups";
import { buildAccessSummary, groupsAreComplete } from "../lib/permissionGroups";
import { BrandMark } from "./BrandMark";
import { Icon } from "./Icon";

export function AccessSummary({
  groups,
  tokenName,
}: {
  groups: PermissionGroup[];
  tokenName: string;
}) {
  const summary = buildAccessSummary(groups);
  const complete = groupsAreComplete(groups) && Boolean(tokenName.trim());
  return (
    <aside className="hidden self-start xl:block xl:sticky xl:top-6">
      <div className="access-preview p-6">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[.2em] text-[#c0ceaa]">
            Your access key
          </span>
          <BrandMark className="h-7 w-7 text-[#d8ec9c]" />
        </div>
        <div className="gate-illustration my-5" aria-hidden="true">
          <div className="gate-arch" />
          <div className="gate-arch" />
          <div className="gate-arch" />
          <div className="gate-core">
            <Icon name="key" size={27} />
          </div>
        </div>
        <p className="text-[9px] uppercase tracking-[.16em] text-[#a9bb94]">
          Preview · not issued
        </p>
        <h3 className="mt-2 break-words text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">
          {tokenName.trim() || "Name your key"}
        </h3>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#516044] pt-5">
          {[
            { value: summary.domainCount, label: "Domains" },
            { value: summary.serviceCount, label: "Services" },
            { value: summary.entityCount, label: "Entities" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-semibold tracking-tight text-[#d8ec9c]">
                {stat.value.toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-[9px] text-[#bec8b0]">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-2 text-[10px] text-[#dce5ca]">
          <Icon name={complete ? "check" : "layers"} size={13} />
          {complete
            ? "Ready for your review"
            : "Complete your permission groups"}
        </div>
      </div>
      <div className="px-2 pt-5">
        <h3 className="text-sm font-semibold tracking-tight">
          A key, not the master key.
        </h3>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
          Only your selected services and entities are shared. Your Home
          Assistant credentials stay on the server.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[9px] uppercase tracking-[.12em] text-[var(--muted)]">
          <Icon name="lock" size={12} />
          Scoped by design
        </div>
      </div>
    </aside>
  );
}
