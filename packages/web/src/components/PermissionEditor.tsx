import type { HaEntity, HaServiceCatalog, TokenPermission } from "../api";
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

function makeDefaultServicePermission(): TokenPermission {
  return {
    kind: "service",
    domain: "light",
    services: ["turn_on", "turn_off"],
    entityIds: []
  };
}

function makeDefaultStatePermission(): TokenPermission {
  return {
    kind: "state",
    entityIds: []
  };
}

function servicesForDomain(domain: string, services: HaServiceCatalog[]): string[] {
  return services.find((entry) => entry.domain === domain)?.services ?? fallbackServices[domain] ?? [];
}

export function defaultTokenPermission(): TokenPermission {
  return makeDefaultServicePermission();
}

export function PermissionEditor({
  permissions,
  onChange,
  entities,
  services,
  disabled
}: {
  permissions: TokenPermission[];
  onChange: (permissions: TokenPermission[]) => void;
  entities: HaEntity[];
  services: HaServiceCatalog[];
  disabled?: boolean;
}) {
  const domainOptions = Array.from(
    new Set([...commonDomains, ...services.map((service) => service.domain)])
  ).sort();

  const updatePermission = (index: number, next: TokenPermission) => {
    onChange(permissions.map((permission, itemIndex) => (itemIndex === index ? next : permission)));
  };

  const removePermission = (index: number) => {
    onChange(permissions.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-4">
      {permissions.map((permission, index) => {
        const serviceOptions =
          permission.kind === "service" ? servicesForDomain(permission.domain, services) : [];
        const entityOptions = entities
          .filter((entity) => permission.kind === "state" || entity.domain === permission.domain)
          .map((entity) => ({
            value: entity.entityId,
            label: entity.name || entity.entityId,
            description: entity.entityId
          }));

        return (
          <div key={index} className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-100">Allowed control #{index + 1}</p>
                <p className="text-xs text-slate-500">
                  {permission.kind === "service"
                    ? "Allows selected Home Assistant service calls."
                    : "Allows reading selected entity states."}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removePermission(index)}
                disabled={disabled || permissions.length === 1}
              >
                Remove
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase text-slate-400">Permission type</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  value={permission.kind}
                  disabled={disabled}
                  onChange={(event) =>
                    updatePermission(
                      index,
                      event.target.value === "state"
                        ? makeDefaultStatePermission()
                        : makeDefaultServicePermission()
                    )
                  }
                >
                  <option value="service">Control devices</option>
                  <option value="state">Read state</option>
                </select>
              </div>

              {permission.kind === "service" ? (
                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-400">Domain</label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    value={permission.domain}
                    disabled={disabled}
                    onChange={(event) => {
                      const domain = event.target.value;
                      const nextServices = servicesForDomain(domain, services);
                      updatePermission(index, {
                        ...permission,
                        domain,
                        services: nextServices.slice(0, Math.min(2, nextServices.length)),
                        entityIds: []
                      });
                    }}
                  >
                    {domainOptions.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {permission.kind === "service" ? (
              <div className="mt-4 space-y-2">
                <label className="text-xs uppercase text-slate-400">Allowed services</label>
                <div className="flex flex-wrap gap-2">
                  {serviceOptions.map((service) => {
                    const selected = permission.services.includes(service);
                    return (
                      <label
                        key={service}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                          selected
                            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                            : "border-slate-800 bg-slate-950/40 text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={(event) => {
                            const nextServices = event.target.checked
                              ? [...permission.services, service]
                              : permission.services.filter((item) => item !== service);
                            updatePermission(index, {
                              ...permission,
                              services: nextServices
                            });
                          }}
                        />
                        {service}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase text-slate-400">
                {permission.kind === "state" ? "Readable entities" : "Allowed entities"}
              </label>
              <SearchableMultiSelect
                values={permission.entityIds}
                onValuesChange={(values) => updatePermission(index, { ...permission, entityIds: values })}
                options={entityOptions}
                placeholder="Select entities"
                searchPlaceholder="Search by name or entity ID"
                emptyText="No matching entities"
                disabled={disabled}
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => onChange([...permissions, makeDefaultServicePermission()])}
          disabled={disabled}
        >
          Add device control
        </Button>
        <Button
          variant="secondary"
          onClick={() => onChange([...permissions, makeDefaultStatePermission()])}
          disabled={disabled}
        >
          Add state read
        </Button>
      </div>
    </div>
  );
}
