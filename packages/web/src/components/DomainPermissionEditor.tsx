import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HaEntity, HaServiceCatalog } from "../api";
import type {
  PermissionGroup,
  ServicePermissionGroup,
} from "../lib/permissionGroups";
import { groupIsComplete } from "../lib/permissionGroups";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { Button } from "./ui/button";
import { Icon } from "./Icon";

const commonDomains = ["light", "switch", "script", "fan", "cover", "button"];
const fallbackServices: Record<string, string[]> = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off"],
  script: ["turn_on"],
  fan: ["turn_on", "turn_off", "toggle"],
  cover: ["open_cover", "close_cover", "stop_cover"],
  button: ["press"],
};

type DomainPermissionEditorProps = {
  groups: PermissionGroup[];
  onChange: (groups: PermissionGroup[]) => void;
  entities: HaEntity[];
  services: HaServiceCatalog[];
  disabled?: boolean;
};

function servicesForDomain(domain: string, services: HaServiceCatalog[]) {
  return (
    services.find((entry) => entry.domain === domain)?.services ??
    fallbackServices[domain] ??
    []
  );
}

export function DomainPermissionEditor({
  groups,
  onChange,
  entities,
  services,
  disabled,
}: DomainPermissionEditorProps) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "light");
  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const groupNav = useRef<HTMLDivElement>(null);
  const pendingGroupFocus = useRef(false);
  const domainSelectId = useId();
  const selectedGroup =
    groups.find((group) => group.id === selectedId) ?? groups[0];
  const domainOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...commonDomains,
          ...services.map((service) => service.domain),
          ...entities.map((entity) => entity.domain),
        ]),
      ).sort(),
    [entities, services],
  );
  const availableDomains = domainOptions.filter(
    (domain) =>
      !groups.some(
        (group) => group.kind === "service" && group.domain === domain,
      ),
  );
  const hasStateGroup = groups.some((group) => group.kind === "state");
  const serviceOptions =
    selectedGroup?.kind === "service"
      ? servicesForDomain(selectedGroup.domain, services)
      : [];
  const entityOptions = entities
    .filter(
      (entity) =>
        selectedGroup?.kind === "state" ||
        entity.domain === selectedGroup?.domain,
    )
    .map((entity) => ({
      value: entity.entityId,
      label: entity.name || entity.entityId,
      description: entity.entityId,
    }));

  useEffect(() => {
    if (!pendingGroupFocus.current) return;
    groupNav.current
      ?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")
      ?.focus();
    pendingGroupFocus.current = false;
  }, [groups, selectedId]);

  function replaceGroup(nextGroup: PermissionGroup) {
    onChange(
      groups.map((group) => (group.id === nextGroup.id ? nextGroup : group)),
    );
  }
  function addServiceGroup() {
    if (!availableDomains.includes(newDomain)) return;
    const nextGroup: ServicePermissionGroup = {
      id: newDomain,
      kind: "service",
      domain: newDomain,
      services: servicesForDomain(newDomain, services).slice(0, 2),
      entityIds: [],
      allowNoEntity: false,
    };
    pendingGroupFocus.current = true;
    onChange([...groups, nextGroup]);
    setSelectedId(newDomain);
    setAddingDomain(false);
  }
  function removeSelectedGroup() {
    if (!selectedGroup || groups.length === 1) return;
    const next = groups.filter((group) => group.id !== selectedGroup.id);
    pendingGroupFocus.current = true;
    onChange(next);
    setSelectedId(next[0]?.id ?? "light");
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:block sm:space-y-3">
        <div className="hidden items-center justify-between sm:flex">
          <p className="studio-label">Permission groups</p>
          <span className="text-[10px] text-[var(--muted)]">
            {groups.length} {groups.length === 1 ? "group" : "groups"}
          </span>
        </div>
        <div
          ref={groupNav}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 sm:flex-none"
          role="group"
          aria-label="Permission groups"
        >
          {groups.map((group) => (
            <button
              type="button"
              key={group.id}
              className="permission-domain"
              aria-pressed={group.id === selectedGroup?.id}
              disabled={disabled}
              onClick={() => {
                setSelectedId(group.id);
                setAddingDomain(false);
              }}
            >
              <Icon
                name={
                  group.kind === "state"
                    ? "activity"
                    : group.domain === "light"
                      ? "light"
                      : "layers"
                }
                size={15}
              />
              {group.kind === "state" ? "State reads" : group.domain}
              {groupIsComplete(group) ? (
                <Icon name="check" size={13} />
              ) : (
                <span className="h-1 w-1 rounded-full bg-[var(--muted)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
            disabled={disabled || !availableDomains.length}
            aria-expanded={addingDomain}
            onClick={() => {
              setNewDomain(availableDomains[0] ?? "");
              setAddingDomain(!addingDomain);
            }}
          >
            <Icon name="plus" size={13} />
            <span className="sr-only sm:not-sr-only">Add domain</span>
          </button>
          <button
            type="button"
            className="flex min-h-10 items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
            disabled={disabled || hasStateGroup}
            onClick={() => {
              pendingGroupFocus.current = true;
              onChange([
                ...groups,
                { id: "state", kind: "state", entityIds: [] },
              ]);
              setSelectedId("state");
              setAddingDomain(false);
            }}
          >
            <Icon name="activity" size={13} />
            Add state reads
          </button>
        </div>
        {addingDomain ? (
          <div className="flex w-full flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="min-w-[120px] flex-1 space-y-1.5">
              <label htmlFor={domainSelectId} className="field-label">
                Domain to add
              </label>
              <select
                id={domainSelectId}
                value={newDomain}
                disabled={disabled}
                onChange={(event) => setNewDomain(event.target.value)}
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              >
                {availableDomains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              disabled={disabled || !availableDomains.includes(newDomain)}
              onClick={addServiceGroup}
            >
              Add permission group
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingDomain(false)}
              aria-label="Cancel adding domain"
            >
              <Icon name="close" size={15} />
            </Button>
          </div>
        ) : null}
      </div>
      {!selectedGroup ? (
        <p className="py-4 text-sm text-[var(--muted)]">
          Add a permission group to begin.
        </p>
      ) : (
        <section className="space-y-3 border-t border-[var(--border)] pt-4 sm:space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight">
                {selectedGroup.kind === "state"
                  ? "State reads"
                  : selectedGroup.domain}
              </h3>
              <p className="mt-1 hidden text-[11px] text-[var(--muted)] sm:block">
                {selectedGroup.kind === "state"
                  ? "Read only the states you select."
                  : "Choose what this key can do, and where."}
              </p>
            </div>
            {groups.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={removeSelectedGroup}
                className="text-[var(--danger)]"
                aria-label="Remove permission group"
              >
                <Icon name="close" size={15} />
              </Button>
            ) : null}
          </div>
          {selectedGroup.kind === "service" ? (
            <div className="space-y-2">
              <p className="field-label">Allowed services</p>
              <div className="flex flex-wrap gap-2">
                {serviceOptions.length ? (
                  serviceOptions.map((service) => (
                    <label
                      key={service}
                      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${selectedGroup.services.includes(service) ? "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroup.services.includes(service)}
                        disabled={disabled}
                        onChange={(event) =>
                          replaceGroup({
                            ...selectedGroup,
                            services: event.target.checked
                              ? [...selectedGroup.services, service]
                              : selectedGroup.services.filter(
                                  (item) => item !== service,
                                ),
                          })
                        }
                      />
                      <span className="font-mono">{service}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    No services are available for this domain.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="field-label">
              {selectedGroup.kind === "state"
                ? "Readable entities"
                : "Allowed entities"}
            </p>
            <SearchableMultiSelect
              values={selectedGroup.entityIds}
              onValuesChange={(entityIds) =>
                replaceGroup({ ...selectedGroup, entityIds })
              }
              options={entityOptions}
              placeholder="Select entities"
              searchPlaceholder="Search by name or entity ID"
              emptyText="No matching entities"
              disabled={disabled}
            />
          </div>
          {selectedGroup.kind === "service" ? (
            <details
              key={selectedGroup.id}
              open={selectedGroup.allowNoEntity || undefined}
              className="group border-t border-[var(--border)] pt-3"
            >
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                Advanced options
                <Icon
                  name="chevron"
                  size={13}
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <label className="mt-2 flex items-start gap-3 rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
                <input
                  type="checkbox"
                  checked={selectedGroup.allowNoEntity}
                  disabled={disabled}
                  onChange={(event) =>
                    replaceGroup({
                      ...selectedGroup,
                      allowNoEntity: event.target.checked,
                    })
                  }
                  className="mt-0.5"
                />
                <span>
                  Allow service calls without an entity target
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--muted)]">
                    Only for services intentionally called without an entity.
                  </span>
                </span>
              </label>
            </details>
          ) : null}
        </section>
      )}
    </div>
  );
}
