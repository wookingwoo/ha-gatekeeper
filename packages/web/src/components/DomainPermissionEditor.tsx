import { useEffect, useMemo, useState } from "react";
import type { HaEntity, HaServiceCatalog } from "../api";
import type { PermissionGroup, ServicePermissionGroup, StatePermissionGroup } from "../lib/permissionGroups";
import { cn } from "../lib/utils";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { Button } from "./ui/button";

const commonDomains = ["light", "switch", "script", "fan", "cover", "button"];
const fallbackServices: Record<string, string[]> = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off"],
  script: ["turn_on"],
  fan: ["turn_on", "turn_off", "toggle"],
  cover: ["open_cover", "close_cover", "stop_cover"],
  button: ["press"]
};

type DomainPermissionEditorProps = {
  groups: PermissionGroup[];
  onChange: (groups: PermissionGroup[]) => void;
  entities: HaEntity[];
  services: HaServiceCatalog[];
  disabled?: boolean;
};

function servicesForDomain(domain: string, services: HaServiceCatalog[]): string[] {
  return services.find((entry) => entry.domain === domain)?.services ?? fallbackServices[domain] ?? [];
}

function serviceGroup(domain: string, services: HaServiceCatalog[]): ServicePermissionGroup {
  const domainServices = servicesForDomain(domain, services);
  return {
    id: domain,
    kind: "service",
    domain,
    services: domainServices.slice(0, Math.min(2, domainServices.length)),
    entityIds: [],
    allowNoEntity: false
  };
}

function stateGroup(): StatePermissionGroup {
  return { id: "state", kind: "state", entityIds: [] };
}

function groupLabel(group: PermissionGroup): string {
  return group.kind === "state" ? "State reads" : group.domain;
}

function groupCount(group: PermissionGroup): number {
  if (group.kind === "state") {
    return group.entityIds.length;
  }
  return group.entityIds.length + (group.allowNoEntity ? 1 : 0);
}

export function DomainPermissionEditor({
  groups,
  onChange,
  entities,
  services,
  disabled
}: DomainPermissionEditorProps) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "light");
  const selectedGroup = groups.find((group) => group.id === selectedId) ?? groups[0];

  const domainOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...commonDomains,
          ...services.map((service) => service.domain),
          ...entities.map((entity) => entity.domain)
        ])
      ).sort(),
    [entities, services]
  );

  const availableDomains = domainOptions.filter(
    (domain) => !groups.some((group) => group.kind === "service" && group.domain === domain)
  );
  const hasStateGroup = groups.some((group) => group.kind === "state");

  useEffect(() => {
    if (!selectedGroup && groups[0]) {
      setSelectedId(groups[0].id);
    }
  }, [groups, selectedGroup]);

  const replaceGroup = (nextGroup: PermissionGroup) => {
    onChange(groups.map((group) => (group.id === nextGroup.id ? nextGroup : group)));
  };

  const removeSelectedGroup = () => {
    if (!selectedGroup || groups.length === 1) return;
    const nextGroups = groups.filter((group) => group.id !== selectedGroup.id);
    onChange(nextGroups);
    setSelectedId(nextGroups[0]?.id ?? "light");
  };

  const addServiceGroup = () => {
    const domain = availableDomains[0];
    if (!domain) return;
    const nextGroup = serviceGroup(domain, services);
    onChange([...groups, nextGroup]);
    setSelectedId(nextGroup.id);
  };

  const addStateGroup = () => {
    const nextGroup = stateGroup();
    onChange([...groups, nextGroup]);
    setSelectedId(nextGroup.id);
  };

  const serviceOptions =
    selectedGroup?.kind === "service" ? servicesForDomain(selectedGroup.domain, services) : [];
  const entityOptions = entities
    .filter((entity) => selectedGroup?.kind === "state" || entity.domain === selectedGroup?.domain)
    .map((entity) => ({
      value: entity.entityId,
      label: entity.name || entity.entityId,
      description: entity.entityId
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">Domains</p>
          <span className="text-xs text-[var(--muted)]">{groups.length} groups</span>
        </div>

        <div className="space-y-2">
          {groups.map((group) => {
            const selected = group.id === selectedGroup?.id;
            return (
              <button
                key={group.id}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedId(group.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                )}
              >
                <span className="font-medium">{groupLabel(group)}</span>
                <span className="text-xs">{groupCount(group)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled || availableDomains.length === 0}
            onClick={addServiceGroup}
          >
            Add domain
          </Button>
          <Button size="sm" variant="secondary" disabled={disabled || hasStateGroup} onClick={addStateGroup}>
            Add state reads
          </Button>
        </div>
      </aside>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        {!selectedGroup ? (
          <div className="rounded-md bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
            Add a domain or state-read group to begin.
          </div>
        ) : selectedGroup.kind === "state" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">State reads</h3>
                <p className="text-sm text-[var(--muted)]">Allow reading selected entity states.</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                disabled={disabled || groups.length === 1}
                onClick={removeSelectedGroup}
              >
                Remove
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Readable entities
              </label>
              <SearchableMultiSelect
                values={selectedGroup.entityIds}
                onValuesChange={(entityIds) => replaceGroup({ ...selectedGroup, entityIds })}
                options={entityOptions}
                placeholder="Select entities"
                searchPlaceholder="Search by name or entity ID"
                emptyText="No matching entities"
                disabled={disabled}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{selectedGroup.domain}</h3>
                <p className="text-sm text-[var(--muted)]">
                  Control selected {selectedGroup.domain} entities.
                </p>
              </div>
              <Button
                size="sm"
                variant="danger"
                disabled={disabled || groups.length === 1}
                onClick={removeSelectedGroup}
              >
                Remove
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Allowed services</p>
              <div className="flex flex-wrap gap-2">
                {serviceOptions.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No services are available for this domain.</p>
                ) : (
                  serviceOptions.map((service) => {
                    const checked = selectedGroup.services.includes(service);
                    return (
                      <label
                        key={service}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-2 text-sm",
                          checked
                            ? "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => {
                            const nextServices = event.target.checked
                              ? [...selectedGroup.services, service]
                              : selectedGroup.services.filter((item) => item !== service);
                            replaceGroup({ ...selectedGroup, services: nextServices });
                          }}
                        />
                        {service}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Allowed entities
              </label>
              <SearchableMultiSelect
                values={selectedGroup.entityIds}
                onValuesChange={(entityIds) => replaceGroup({ ...selectedGroup, entityIds })}
                options={entityOptions}
                placeholder="Select entities"
                searchPlaceholder="Search by name or entity ID"
                emptyText="No matching entities"
                disabled={disabled}
              />
            </div>

            <label className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
              <input
                type="checkbox"
                checked={selectedGroup.allowNoEntity}
                disabled={disabled}
                onChange={(event) =>
                  replaceGroup({ ...selectedGroup, allowNoEntity: event.target.checked })
                }
              />
              <span>
                Allow service calls without an entity target
                <span className="block text-xs text-[var(--muted)]">
                  Use only for Home Assistant services that are intentionally entity-less.
                </span>
              </span>
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
