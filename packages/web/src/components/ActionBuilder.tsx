import type { Dispatch, SetStateAction } from "react";
import { HaEntity, Role } from "../api";
import { ActionFormState } from "../types";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { SearchableSelect } from "./SearchableSelect";
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
  const selectBase =
    "h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">Basic information</p>
            <p className="text-xs text-slate-500">
              The action ID and name are used in API calls.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
              <label className="text-xs uppercase text-slate-400" htmlFor="action-id">
              Action ID
              <span className="ml-2 inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                Required
              </span>
            </label>
            <Input
              id="action-id"
              placeholder="e.g., living_room_lights_on"
              value={actionForm.id}
              onChange={(event) => setActionForm({ ...actionForm, id: event.target.value })}
            />
            <p className="text-xs text-slate-500">
              Used in the <span className="font-mono">/v1/actions/{"{id}"}</span> path.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-name">
              Action Name
              <span className="ml-2 inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                Required
              </span>
            </label>
            <Input
              id="action-name"
              placeholder="e.g., Turn on living room lights"
              value={actionForm.name}
              onChange={(event) => setActionForm({ ...actionForm, name: event.target.value })}
            />
            <p className="text-xs text-slate-500">Enter a name that operators will recognize.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-desc">
              Description
            </label>
            <Textarea
              id="action-desc"
              className="min-h-[84px]"
              placeholder="e.g., Turn on living room lights in evening mode."
              value={actionForm.description}
              onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-status">
              Status
            </label>
            <select
              id="action-status"
              className={selectBase}
              value={actionForm.status}
              onChange={(event) =>
                setActionForm({
                  ...actionForm,
                  status: event.target.value as ActionFormState["status"]
                })
              }
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
            <p className="text-xs text-slate-500">
              disabled blocks calls immediately after creation.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">
              Permissions
              <span className="ml-2 inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                Required
              </span>
            </p>
            <p className="text-xs text-slate-500">Select roles that can call this action.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setActionForm({
                  ...actionForm,
                  roleIds: roleOptions.map((role) => role.id)
                })
              }
              disabled={roleOptions.length === 0}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActionForm({ ...actionForm, roleIds: [] })}
              disabled={actionForm.roleIds.length === 0}
            >
              Clear selection
            </Button>
          </div>
        </div>
        {roleOptions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No roles yet. Create a role in the Roles tab first.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
            {roleOptions.map((role) => {
              const selected = actionForm.roleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                    selected
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400"
                    checked={selected}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...actionForm.roleIds, role.id]
                        : actionForm.roleIds.filter((id) => id !== role.id);
                      setActionForm({ ...actionForm, roleIds: next });
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">{role.id}</span>
                    <span>{role.name}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">Home Assistant calls</p>
            <p className="text-xs text-slate-500">
              You can run multiple HA services sequentially in one action.
            </p>
          </div>
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
            + Add call
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {actionForm.calls.map((call, index) => {
            const servicesForDomain = call.domain ? serviceMap.get(call.domain.trim()) ?? [] : [];
            const entitiesForDomain = call.domain ? entityMap.get(call.domain.trim()) ?? [] : [];
            const summaryParts = [];
            if (call.domain && call.service) summaryParts.push(`${call.domain}.${call.service}`);
            if (call.entityIds.length > 0) summaryParts.push(`Entities ${call.entityIds.length}`);

            return (
              <div
                key={`call-${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Call {index + 1}</p>
                    <p className="text-xs text-slate-500">
                      {summaryParts.length > 0
                        ? `Summary: ${summaryParts.join(" / ")}`
                        : "Select a domain and service."}
                    </p>
                  </div>
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
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-400">Domain</label>
                    <SearchableSelect
                      value={call.domain}
                      onValueChange={(value) => {
                        const next = [...actionForm.calls];
                        next[index] = { ...next[index], domain: value, service: "" };
                        setActionForm({ ...actionForm, calls: next });
                      }}
                      options={[...serviceMap.keys()]}
                      placeholder="Select domain"
                      searchPlaceholder="Search domains..."
                      emptyText="No domains found"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-400">Service</label>
                    <SearchableSelect
                      value={call.service}
                      onValueChange={(value) => {
                        const next = [...actionForm.calls];
                        next[index] = { ...next[index], service: value };
                        setActionForm({ ...actionForm, calls: next });
                      }}
                      options={servicesForDomain}
                      placeholder="Select service"
                      searchPlaceholder="Search services..."
                      emptyText="No services found"
                      disabled={!call.domain}
                    />
                    <p className="text-xs text-slate-500">
                      Available services appear after selecting a domain.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-400">Entities (optional)</label>
                    <SearchableMultiSelect
                      values={call.entityIds}
                      onValuesChange={(values) => {
                        const next = [...actionForm.calls];
                        next[index] = { ...next[index], entityIds: values };
                        setActionForm({ ...actionForm, calls: next });
                      }}
                      options={entitiesForDomain.map((entity) => ({
                        value: entity.entityId,
                        label: entity.name || entity.entityId,
                        description: entity.entityId
                      }))}
                      placeholder={call.domain ? "Select entities" : "Select a domain first"}
                      searchPlaceholder="Search entities..."
                      emptyText={call.domain ? "No entities" : "Select a domain first"}
                      disabled={!call.domain}
                    />
                    <p className="text-xs text-slate-500">
                      Leave empty if the service does not require entities.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-xs uppercase text-slate-400">
                    Service data JSON (optional)
                  </label>
                  <p className="text-xs text-slate-500">
                    HA service data. e.g., {"{ \"brightness\": 120 }"}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div>
          <p className="text-sm font-medium text-slate-100">Ready to create action</p>
          <p className="text-xs text-slate-500">
            The Create button activates after ID, Name, and Role are set.
          </p>
        </div>
        <Button onClick={onCreate} disabled={isDisabled}>
          Create action
        </Button>
      </div>
    </div>
  );
}
