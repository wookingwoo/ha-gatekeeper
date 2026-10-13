import type { HaEntity } from "../api";
import type { PermissionGroup } from "../lib/permissionGroups";
import { Icon } from "./Icon";

export function PermissionReview({
  groups,
  entities,
}: {
  groups: PermissionGroup[];
  entities: HaEntity[];
}) {
  const entityNames = new Map(
    entities.map((entity) => [entity.entityId, entity.name]),
  );
  return (
    <div className="divide-y divide-[var(--border)]">
      {groups.map((group) => (
        <section key={group.id} className="py-5 first:pt-0 last:pb-0">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="icon-tile h-8 w-8">
              <Icon
                name={group.kind === "state" ? "activity" : "light"}
                size={15}
              />
            </span>
            <h4 className="text-sm font-semibold">
              {group.kind === "state" ? "State reads" : group.domain}
            </h4>
            <span className="ml-auto text-xs text-[var(--muted)]">
              {group.entityIds.length}{" "}
              {group.entityIds.length === 1 ? "entity" : "entities"}
            </span>
          </div>
          {group.kind === "service" ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {group.services.map((service) => (
                <code
                  key={service}
                  className="rounded-md border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-1.5 text-xs text-[var(--primary)]"
                >
                  {group.domain}.{service}
                </code>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-[var(--muted)]">
              Read-only access to these entity states.
            </p>
          )}
          <ul className="space-y-2">
            {group.entityIds.map((entityId) => (
              <li key={entityId} className="flex items-start gap-2.5 text-xs">
                <Icon
                  name="check"
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--success)]"
                />
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {entityNames.get(entityId) || entityId}
                  </p>
                  <code className="mt-0.5 block break-all text-xs text-[var(--muted)]">
                    {entityId}
                  </code>
                </div>
              </li>
            ))}
          </ul>
          {group.kind === "service" && group.allowNoEntity ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
              Calls without an entity target are allowed for these services.
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
