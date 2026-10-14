import { useState } from "react";
import type {
  Client,
  HaEntity,
  HaServiceCatalog,
  TokenPermission,
} from "../api";
import { DomainPermissionEditor } from "../components/DomainPermissionEditor";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { CopyButton } from "../components/CopyButton";
import { EmptyState, ErrorNotice, LoadingState } from "../components/Feedback";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  downloadAgentBundle,
  getDefaultGatekeeperBaseUrl,
} from "../lib/agentBundle";
import {
  buildAccessSummary,
  groupsAreComplete,
  groupsToPermissions,
  permissionsToGroups,
  type PermissionGroup,
} from "../lib/permissionGroups";

type TokensPageProps = {
  clients: Client[];
  entities: HaEntity[];
  services: HaServiceCatalog[];
  issuedKey: string | null;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onCreate: () => void;
  isMutating: boolean;
  mutationError: string | null;
  canEditPermissions: boolean;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onSavePermissions: (
    id: string,
    permissions: TokenPermission[],
  ) => Promise<void>;
};

function summarizeClient(client: Client): string {
  if (!client.permissions.length) return "No permissions";
  const summary = buildAccessSummary(permissionsToGroups(client.permissions));
  return `${summary.domainCount} domains · ${summary.serviceCount} services · ${summary.entityCount} entities`;
}

export function TokensPage({
  clients,
  entities,
  services,
  issuedKey,
  isLoading,
  hasError,
  onRetry,
  onCreate,
  isMutating,
  mutationError,
  canEditPermissions,
  onRotate,
  onDelete,
  onSavePermissions,
}: TokensPageProps) {
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [draftGroups, setDraftGroups] = useState<PermissionGroup[]>([]);
  const [bundleBaseUrl, setBundleBaseUrl] = useState(() =>
    getDefaultGatekeeperBaseUrl(),
  );
  const [bundleErrorClientId, setBundleErrorClientId] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All tokens");
  const active = clients.filter((client) => client.status === "active").length;
  const visible = clients.filter(
    (client) =>
      (filter === "All tokens" || client.status === filter.toLowerCase()) &&
      `${client.name} ${client.apiKeyPrefix}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  function handleDownloadBundle(client: Client) {
    setBundleErrorClientId(null);
    try {
      downloadAgentBundle({
        clientName: client.name,
        baseUrl: bundleBaseUrl.trim(),
        permissions: client.permissions,
        tokenMode: "placeholder",
      });
    } catch {
      setBundleErrorClientId(client.id);
    }
  }

  async function savePermissions(clientId: string) {
    try {
      await onSavePermissions(clientId, groupsToPermissions(draftGroups));
      setEditingClientId(null);
      setDraftGroups([]);
    } catch {
      // Keep the draft open; the request error is shown above the list.
    }
  }

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="02 / Your keys"
        title="Tokens"
        description="A key for every connection. Keep an eye on who has access, and make every permission intentional."
      >
        <Button onClick={onCreate}>
          <Icon name="plus" size={16} />
          Create token
        </Button>
      </PageHeading>
      {hasError ? (
        <ErrorNotice onRetry={onRetry}>
          Could not load tokens. Please try again.
        </ErrorNotice>
      ) : null}
      {mutationError ? <ErrorNotice>{mutationError}</ErrorNotice> : null}
      {issuedKey ? (
        <Card className="border-[var(--primary-border)]">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="icon-tile">
                <Icon name="check" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">New bearer token</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Copy it now. The previous key no longer works.
                </p>
              </div>
            </div>
            <p className="break-all rounded-xl bg-[var(--primary-soft)] p-4 font-mono text-sm text-[var(--primary)]">
              {issuedKey}
            </p>
            <CopyButton value={issuedKey} label="Copy token" />
          </CardContent>
        </Card>
      ) : null}
      <div className="metrics-line">
        {[
          { label: "Total keys", count: clients.length },
          { label: "Active access", count: active },
          { label: "Disabled", count: clients.length - active },
        ].map((stat) => (
          <div key={stat.label} className="metric">
            <p className="metric-value">
              {isLoading || (hasError && !clients.length)
                ? "—"
                : stat.count.toString().padStart(2, "0")}
            </p>
            <p className="metric-label">{stat.label}</p>
          </div>
        ))}
      </div>
      <Card className="rounded-xl shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5 sm:px-6">
          <div>
            <h3 className="text-base font-semibold">Issued tokens</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Manage the keys to your home
            </p>
          </div>
          <Badge>{clients.length} tokens</Badge>
        </div>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="search-field">
              <Icon name="search" size={17} />
              <Input
                type="search"
                aria-label="Search tokens"
                placeholder="Search by name or prefix…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <div
              role="group"
              aria-label="Filter tokens"
              className="flex rounded-xl bg-[var(--surface-muted)] p-1"
            >
              {["All tokens", "Active", "Disabled"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="filter-button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <LoadingState label="Loading tokens…" />
          ) : !visible.length ? (
            hasError && !clients.length ? null : (
              <EmptyState
                icon="key"
                title={
                  clients.length
                    ? "No matching tokens"
                    : "Your first key starts here"
                }
                description={
                  clients.length
                    ? "Try another name, prefix, or token status."
                    : "Create a scoped token to share just the access you choose."
                }
              >
                {clients.length ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setFilter("All tokens");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={onCreate}>
                    <Icon name="plus" size={16} />
                    Create your first token
                  </Button>
                )}
              </EmptyState>
            )
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {visible.map((client) => (
                <article key={client.id} className="py-5 first:pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div className="icon-tile mt-1 flex rounded-full">
                        <Icon name="key" size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                            {client.name}
                          </h4>
                          <Badge
                            variant={
                              client.status === "active" ? "success" : "default"
                            }
                          >
                            <span className="h-1 w-1 rounded-full bg-current" />
                            {client.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {summarizeClient(client)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                          <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">
                            {client.apiKeyPrefix}…
                          </code>
                          <span>
                            Created{" "}
                            <time dateTime={client.createdAt}>
                              {new Date(client.createdAt).toLocaleDateString()}
                            </time>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Download bundle for ${client.name}`}
                        onClick={() => handleDownloadBundle(client)}
                      >
                        <Icon name="download" size={14} />
                        Download bundle
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isMutating || !canEditPermissions}
                        onClick={() => {
                          setEditingClientId(client.id);
                          setDraftGroups(
                            permissionsToGroups(client.permissions),
                          );
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isMutating}
                        onClick={() => {
                          if (
                            confirm(
                              `Rotate token "${client.name}"? The current bearer token will stop working immediately.`,
                            )
                          )
                            onRotate(client.id);
                        }}
                      >
                        <Icon name="refresh" size={13} />
                        Rotate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        disabled={isMutating}
                        onClick={() => {
                          if (
                            confirm(
                              `Delete token "${client.name}"? This cannot be undone.`,
                            )
                          )
                            onDelete(client.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {bundleErrorClientId === client.id ? (
                    <p
                      role="alert"
                      className="mt-3 text-xs text-[var(--danger)]"
                    >
                      Could not create the bundle. Check the API base URL below
                      and try again.
                    </p>
                  ) : null}
                  {editingClientId === client.id ? (
                    <div className="mt-5 space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-5">
                      <div>
                        <h4 className="text-sm font-semibold">
                          Edit permissions
                        </h4>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Changes apply to this token as soon as you save.
                        </p>
                      </div>
                      <DomainPermissionEditor
                        groups={draftGroups}
                        onChange={setDraftGroups}
                        entities={entities}
                        services={services}
                        disabled={isMutating || !canEditPermissions}
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          disabled={isMutating}
                          onClick={() => {
                            setEditingClientId(null);
                            setDraftGroups([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={
                            isMutating ||
                            !canEditPermissions ||
                            !groupsAreComplete(draftGroups) ||
                            !groupsToPermissions(draftGroups).length
                          }
                          onClick={() => savePermissions(client.id)}
                        >
                          {isMutating ? "Saving…" : "Save permissions"}
                          <Icon name="check" size={15} />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {!canEditPermissions && !isLoading && clients.length ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Permission editing is available when Home Assistant data is
              connected.
            </p>
          ) : null}
          <details className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <summary className="cursor-pointer text-xs font-medium text-[var(--muted)]">
              Agent bundle settings
            </summary>
            <div className="mt-4 max-w-xl space-y-2">
              <label htmlFor="tokens-bundle-base-url" className="field-label">
                Gatekeeper API base URL
              </label>
              <Input
                id="tokens-bundle-base-url"
                value={bundleBaseUrl}
                onChange={(event) => setBundleBaseUrl(event.target.value)}
                placeholder="http://homeassistant.local:4283"
              />
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Bundles from this list use a placeholder token. Add your saved
                bearer token after downloading.
              </p>
            </div>
          </details>
          <p role="status" className="mt-4 text-xs text-[var(--muted)]">
            Showing {visible.length} of {clients.length} tokens
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
