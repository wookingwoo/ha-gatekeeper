import type { Dispatch, SetStateAction } from "react";
import { HaEntity, Role } from "../api";
import { ActionFormState } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export function ActionBuilder({
  actionForm,
  setActionForm,
  roleOptions,
  serviceMap,
  entityMap,
  onCreate,
  isDisabled
}: {
  actionForm: ActionFormState;
  setActionForm: Dispatch<SetStateAction<ActionFormState>>;
  roleOptions: Role[];
  serviceMap: Map<string, string[]>;
  entityMap: Map<string, HaEntity[]>;
  onCreate: () => void;
  isDisabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          placeholder="action id"
          value={actionForm.id}
          onChange={(event) => setActionForm({ ...actionForm, id: event.target.value })}
        />
        <Input
          placeholder="action name"
          value={actionForm.name}
          onChange={(event) => setActionForm({ ...actionForm, name: event.target.value })}
        />
        <Input
          placeholder="description"
          value={actionForm.description}
          onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
        />
        <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs uppercase text-slate-400">Allowed Roles</p>
          <div className="mt-2 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
            {roleOptions.map((role) => (
              <label key={role.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400"
                  checked={actionForm.roleIds.includes(role.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...actionForm.roleIds, role.id]
                      : actionForm.roleIds.filter((id) => id !== role.id);
                    setActionForm({ ...actionForm, roleIds: next });
                  }}
                />
                <span className="text-xs text-slate-400">{role.id}</span>
                <span>{role.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {actionForm.calls.map((call, index) => {
          const servicesForDomain = call.domain ? serviceMap.get(call.domain.trim()) ?? [] : [];
          const entitiesForDomain = call.domain ? entityMap.get(call.domain.trim()) ?? [] : [];

          return (
            <div key={`call-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <select
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    value={call.domain}
                    onChange={(event) => {
                      const next = [...actionForm.calls];
                      next[index] = { ...next[index], domain: event.target.value, service: "" };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                  >
                    <option value="">Select domain</option>
                    {[...serviceMap.keys()].map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="domain (manual override)"
                    value={call.domain}
                    onChange={(event) => {
                      const next = [...actionForm.calls];
                      next[index] = { ...next[index], domain: event.target.value };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <select
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    value={call.service}
                    onChange={(event) => {
                      const next = [...actionForm.calls];
                      next[index] = { ...next[index], service: event.target.value };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                    disabled={!call.domain}
                  >
                    <option value="">Select service</option>
                    {servicesForDomain.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="service (manual override)"
                    value={call.service}
                    onChange={(event) => {
                      const next = [...actionForm.calls];
                      next[index] = { ...next[index], service: event.target.value };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <select
                    multiple
                    className="h-28 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    value={call.entityIds}
                    onChange={(event) => {
                      const selected = Array.from(event.target.selectedOptions).map(
                        (option) => option.value
                      );
                      const next = [...actionForm.calls];
                      next[index] = { ...next[index], entityIds: selected };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                    disabled={!call.domain}
                  >
                    {entitiesForDomain.map((entity) => (
                      <option key={entity.entityId} value={entity.entityId}>
                        {entity.name} ({entity.entityId})
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="entity_id(s) comma separated"
                    value={call.entityIds.join(", ")}
                    onChange={(event) => {
                      const next = [...actionForm.calls];
                      const parsed = event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean);
                      next[index] = { ...next[index], entityIds: parsed };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500">
                  HA service data JSON (optional). Example: {"{ \"brightness\": 120 }"}
                </p>
                <Textarea
                  placeholder='{"brightness":120}'
                  value={call.data}
                  onChange={(event) => {
                    const next = [...actionForm.calls];
                    next[index] = { ...next[index], data: event.target.value };
                    setActionForm({ ...actionForm, calls: next });
                  }}
                />
                {actionForm.calls.length > 1 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = actionForm.calls.filter((_, i) => i !== index);
                      setActionForm({ ...actionForm, calls: next });
                    }}
                  >
                    Remove call
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setActionForm({
              ...actionForm,
              calls: [...actionForm.calls, { domain: "", service: "", entityIds: [], data: "" }]
            })
          }
        >
          Add HA call
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onCreate} disabled={isDisabled}>
          액션 생성
        </Button>
      </div>
    </div>
  );
}
