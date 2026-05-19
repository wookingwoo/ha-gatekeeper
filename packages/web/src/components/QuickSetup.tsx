import { useMemo, useState } from "react";
import type { HaEntity, QuickSetupPayload, QuickSetupResult, QuickSetupUseCase } from "../api";
import type { QuickSetupState } from "../types";
import { AccessPreview } from "./AccessPreview";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

const useCases: Array<{
  id: QuickSetupUseCase;
  title: string;
  description: string;
  domain: string;
}> = [
  {
    id: "control_lights",
    title: "Control lights",
    description: "Allow turn_on, turn_off, and toggle for selected lights.",
    domain: "light"
  },
  {
    id: "control_switches",
    title: "Control switches",
    description: "Allow turn_on and turn_off for selected switches.",
    domain: "switch"
  },
  {
    id: "run_scripts",
    title: "Run scripts",
    description: "Allow script.turn_on for selected Home Assistant scripts.",
    domain: "script"
  }
];

function defaultTokenName(useCase: QuickSetupUseCase | "") {
  const found = useCases.find((item) => item.id === useCase);
  return found ? `${found.title} token` : "";
}

export function QuickSetup({
  entities,
  isLoadingEntities,
  hasEntityError,
  onRetryEntities,
  onCreate,
  result,
  isSubmitting
}: {
  entities: HaEntity[];
  isLoadingEntities: boolean;
  hasEntityError: boolean;
  onRetryEntities: () => void;
  onCreate: (payload: QuickSetupPayload) => void;
  result: QuickSetupResult | null;
  isSubmitting: boolean;
}) {
  const [state, setState] = useState<QuickSetupState>({
    step: "use-case",
    useCase: "",
    targetEntityIds: [],
    tokenName: ""
  });

  const selectedUseCase = useCases.find((item) => item.id === state.useCase);
  const filteredEntities = useMemo(
    () =>
      selectedUseCase
        ? entities.filter((entity) => entity.domain === selectedUseCase.domain)
        : [],
    [entities, selectedUseCase]
  );

  const canSubmit = Boolean(state.useCase && state.targetEntityIds.length > 0);
  const tokenName = state.tokenName || defaultTokenName(state.useCase);

  if (result) {
    const policy = result.actions[0]?.haCalls[0];
    const firstEntityId = policy?.entityIds?.[0] ?? "";
    const curl = policy
      ? [
          `curl -X POST /api/services/${policy.domain}/${policy.service}`,
          `  -H "Authorization: Bearer <TOKEN>"`,
          `  -H "Content-Type: application/json"`,
          `  -d '{"entity_id":"${firstEntityId}"}'`
        ].join(" \\\n")
      : "";

    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Token issued</CardTitle>
          <p className="text-sm text-slate-400">Copy this token now. It will not be shown again.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-4 font-mono text-sm text-emerald-200">
            {result.apiKey}
          </div>
          <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-950/70 p-4 text-xs text-emerald-200">
            {curl}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigator.clipboard.writeText(result.apiKey)}>Copy token</Button>
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(curl)}>
              Copy curl
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Setup</CardTitle>
          <p className="text-sm text-slate-400">
            Create scoped Home Assistant access without editing roles or policies manually.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 md:grid-cols-4">
            {["Use case", "Targets", "Review", "Token"].map((label) => (
              <div
                key={label}
                className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs uppercase text-slate-400"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {useCases.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-md border p-4 text-left transition-colors ${
                  state.useCase === item.id
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/40 hover:bg-slate-900/70"
                }`}
                onClick={() =>
                  setState({
                    step: "targets",
                    useCase: item.id,
                    targetEntityIds: [],
                    tokenName: defaultTokenName(item.id)
                  })
                }
              >
                <p className="font-semibold text-slate-100">{item.title}</p>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
              </button>
            ))}
          </div>

          {hasEntityError ? (
            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
              <p className="font-medium">Cannot load entities</p>
              <p className="mt-1 text-rose-200/80">Check HA_BASE_URL and HA_TOKEN, then retry.</p>
              <Button className="mt-3" variant="secondary" onClick={onRetryEntities}>
                Retry
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400">Targets</label>
            <SearchableMultiSelect
              values={state.targetEntityIds}
              onValuesChange={(values) =>
                setState({ ...state, step: "targets", targetEntityIds: values })
              }
              options={filteredEntities.map((entity) => ({
                value: entity.entityId,
                label: entity.name,
                description: entity.entityId
              }))}
              placeholder={
                selectedUseCase
                  ? isLoadingEntities
                    ? "Loading entities..."
                    : "Select targets"
                  : "Choose a use case first"
              }
              searchPlaceholder="Search by name or entity ID"
              emptyText="No matching entities"
              disabled={!selectedUseCase || isLoadingEntities || hasEntityError}
            />
            <p className="text-xs text-slate-500">Only selected entities will be allowed.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400">Token name</label>
            <Input
              value={tokenName}
              onChange={(event) => setState({ ...state, tokenName: event.target.value })}
              placeholder="Living room lights"
            />
          </div>

          <Button
            disabled={!canSubmit || isSubmitting}
            onClick={() =>
              onCreate({
                useCase: state.useCase as QuickSetupUseCase,
                targetEntityIds: state.targetEntityIds,
                tokenName
              })
            }
          >
            Issue token
          </Button>
        </CardContent>
      </Card>

      <AccessPreview
        useCase={state.useCase}
        targetCount={state.targetEntityIds.length}
        tokenName={tokenName}
      />
    </div>
  );
}
