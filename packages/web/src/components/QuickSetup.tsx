import { useEffect, useMemo, useState } from "react";
import type { HaEntity, HaServiceCatalog, QuickSetupPayload, QuickSetupResult, TokenPermission } from "../api";
import { HomeAssistantTokenHelp } from "./HomeAssistantTokenHelp";
import { defaultTokenPermission, PermissionEditor } from "./PermissionEditor";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

function permissionIsComplete(permission: TokenPermission): boolean {
  if (permission.entityIds.length === 0) {
    return false;
  }
  if (permission.kind === "service") {
    return Boolean(permission.domain && permission.services.length > 0);
  }
  return true;
}

export function QuickSetup({
  entities,
  services,
  isLoadingEntities,
  hasEntityError,
  onRetryEntities,
  onCreate,
  result,
  isSubmitting
}: {
  entities: HaEntity[];
  services: HaServiceCatalog[];
  isLoadingEntities: boolean;
  hasEntityError: boolean;
  onRetryEntities: () => void;
  onCreate: (payload: QuickSetupPayload) => void;
  result: QuickSetupResult | null;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("Mom access");
  const [permissions, setPermissions] = useState<TokenPermission[]>([defaultTokenPermission()]);
  const [helpOpen, setHelpOpen] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(name.trim()) && permissions.length > 0 && permissions.every(permissionIsComplete),
    [name, permissions]
  );

  useEffect(() => {
    if (!helpOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHelpOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [helpOpen]);

  const selectedEntityCount = new Set(permissions.flatMap((permission) => permission.entityIds)).size;
  const selectedServiceCount = permissions.reduce(
    (total, permission) => total + (permission.kind === "service" ? permission.services.length : 0),
    0
  );

  if (result) {
    const servicePermission = result.client.permissions.find(
      (permission): permission is Extract<TokenPermission, { kind: "service" }> =>
        permission.kind === "service"
    );
    const statePermission = result.client.permissions.find(
      (permission): permission is Extract<TokenPermission, { kind: "state" }> =>
        permission.kind === "state"
    );
    const curl = servicePermission
      ? [
          `curl -X POST /api/services/${servicePermission.domain}/${servicePermission.services[0]}`,
          `  -H "Authorization: Bearer <TOKEN>"`,
          `  -H "Content-Type: application/json"`,
          `  -d '{"entity_id":"${servicePermission.entityIds[0]}"}'`
        ].join(" \\\n")
      : statePermission
        ? [
            `curl /api/states/${statePermission.entityIds[0]}`,
            `  -H "Authorization: Bearer <TOKEN>"`
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
          {curl ? (
            <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-950/70 p-4 text-xs text-emerald-200">
              {curl}
            </pre>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigator.clipboard.writeText(result.apiKey)}>Copy token</Button>
            {curl ? (
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(curl)}>
                Copy curl
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass mx-auto max-w-5xl">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>Quick Start</CardTitle>
            <p className="mt-2 text-sm text-slate-400">
              Create one token with only the controls and state reads it should be allowed to use.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setHelpOpen(true)}>
            HA setup help
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400">Token name</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mom access"
            />
          </div>

          {hasEntityError ? (
            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
              <p className="font-medium">Cannot load entities</p>
              <p className="mt-1 text-rose-200/80">
                Check HA_BASE_URL and HA_TOKEN. If HA_TOKEN is missing or invalid, use the Home
                Assistant token guide on this page, restart the server, then retry.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onRetryEntities}>
                  Retry
                </Button>
                <Button variant="ghost" onClick={() => setHelpOpen(true)}>
                  Open token guide
                </Button>
              </div>
            </div>
          ) : null}

          <PermissionEditor
            permissions={permissions}
            onChange={setPermissions}
            entities={entities}
            services={services}
            disabled={isSubmitting || isLoadingEntities || hasEntityError}
          />

          <Button
            disabled={!canSubmit || isSubmitting || isLoadingEntities || hasEntityError}
            onClick={() => onCreate({ name, permissions })}
          >
            Issue token
          </Button>

          <div className="grid gap-3 rounded-md border border-slate-800 bg-slate-950/45 p-4 text-sm text-slate-300 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Token</p>
              <p className="mt-1 font-medium text-slate-100">{name || "Name this token"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Permission rules</p>
              <p className="mt-1 font-medium text-slate-100">
                {permissions.length} rule{permissions.length === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Selected access</p>
              <p className="mt-1 font-medium text-slate-100">
                {selectedEntityCount} entities, {selectedServiceCount} services
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {helpOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Connect Home Assistant"
          onClick={() => setHelpOpen(false)}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <Button variant="secondary" onClick={() => setHelpOpen(false)}>
                Close
              </Button>
            </div>
            <HomeAssistantTokenHelp className="shadow-2xl" />
          </div>
        </div>
      ) : null}
    </>
  );
}
