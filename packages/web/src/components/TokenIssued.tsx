import { useState } from "react";
import type { QuickSetupResult, TokenPermission } from "../api";
import {
  downloadAgentBundle,
  getDefaultGatekeeperBaseUrl,
} from "../lib/agentBundle";
import { BrandMark } from "./BrandMark";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { PageHeading } from "./PageHeading";
import { ErrorNotice } from "./Feedback";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

function makeCurl(permissions: TokenPermission[]) {
  const service = permissions.find(
    (permission) => permission.kind === "service",
  );
  if (service?.kind === "service") {
    const body = service.entityIds.length
      ? { entity_id: service.entityIds[0] }
      : {};
    return [
      `curl -X POST /api/services/${service.domain}/${service.services[0]}`,
      '  -H "Authorization: Bearer <TOKEN>"',
      '  -H "Content-Type: application/json"',
      `  -d '${JSON.stringify(body)}'`,
    ].join(" \\\n");
  }
  const state = permissions.find((permission) => permission.kind === "state");
  return state?.kind === "state"
    ? [
        `curl /api/states/${state.entityIds[0]}`,
        '  -H "Authorization: Bearer <TOKEN>"',
      ].join(" \\\n")
    : "";
}

export function TokenIssued({
  result,
  onCreateAnother,
}: {
  result: QuickSetupResult;
  onCreateAnother: () => void;
}) {
  const [includeToken, setIncludeToken] = useState(false);
  const [baseUrl, setBaseUrl] = useState(getDefaultGatekeeperBaseUrl);
  const [bundleError, setBundleError] = useState(false);
  const curl = makeCurl(result.client.permissions);
  function downloadBundle() {
    setBundleError(false);
    try {
      downloadAgentBundle({
        clientName: result.client.name,
        baseUrl: baseUrl.trim(),
        permissions: result.client.permissions,
        tokenMode: includeToken ? "included" : "placeholder",
        liveToken: includeToken ? result.apiKey : undefined,
      });
    } catch {
      setBundleError(true);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Quick Start / all set"
        title="Token issued"
        description="Your access key is ready. Copy it now — it will not be shown again."
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="studio-panel">
          <div className="studio-panel-head">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                <Icon name="check" size={22} />
              </span>
              <div>
                <p className="studio-label">Your new key</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">
                  {result.client.name}
                </h3>
              </div>
            </div>
            <BrandMark className="h-10 w-10 text-[var(--primary)]" />
          </div>
          <div className="space-y-5 p-4 sm:p-6">
            <div>
              <p className="field-label mb-2">Bearer token</p>
              <p className="break-all rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] p-5 font-mono text-sm leading-relaxed text-[var(--primary)]">
                {result.apiKey}
              </p>
            </div>
            <CopyButton value={result.apiKey} label="Copy token" />
            <p className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--muted)]">
              <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
              Store it somewhere private. This key grants exactly the access you
              reviewed.
            </p>
            {curl ? (
              <details className="border-t border-[var(--border)] pt-4">
                <summary className="cursor-pointer text-xs font-semibold">
                  Example request
                </summary>
                <pre className="my-4 overflow-auto rounded-lg bg-[var(--surface-muted)] p-4 text-[10px] leading-relaxed">
                  {curl}
                </pre>
                <CopyButton
                  value={curl}
                  label="Copy curl"
                  variant="secondary"
                />
              </details>
            ) : null}
          </div>
          <div className="setup-actions">
            <p className="text-[11px] text-[var(--muted)]">
              One key. Only your rules.
            </p>
            <Button variant="secondary" onClick={onCreateAnother}>
              <Icon name="plus" size={14} />
              Create another token
            </Button>
          </div>
        </section>
        <section className="studio-panel p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <Icon name="download" size={18} />
            <h3 className="text-sm font-semibold">Agent setup bundle</h3>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">
            Give your agent a head start with instructions, OpenAPI metadata,
            OpenClaw skill notes, and curl examples.
          </p>
          <div className="space-y-2">
            <label htmlFor="quickstart-bundle-base-url" className="field-label">
              Gatekeeper API base URL
            </label>
            <Input
              id="quickstart-bundle-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="http://homeassistant.local:4283"
            />
          </div>
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={downloadBundle}
          >
            <Icon name="download" size={15} />
            Download agent setup bundle
          </Button>
          <label className="mt-5 flex items-start gap-2.5 border-t border-[var(--border)] pt-4 text-[11px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeToken}
              onChange={(event) => setIncludeToken(event.target.checked)}
            />
            <span>
              Include bearer token in bundle
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--muted)]">
                Off by default. Your bundle will use a placeholder token.
              </span>
            </span>
          </label>
          {includeToken ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3 text-[11px] leading-relaxed text-[var(--danger)]"
            >
              This bundle contains a live bearer token. Anyone with the zip can
              use its allowed actions until the token is rotated, disabled, or
              deleted.
            </p>
          ) : null}
          {bundleError ? (
            <div className="mt-4">
              <ErrorNotice>
                Could not create the bundle. Check the API URL and try again
                while this token is visible.
              </ErrorNotice>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
