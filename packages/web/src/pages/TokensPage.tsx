import { Fragment, useState } from "react";
import type { Client, HaEntity, HaServiceCatalog, TokenPermission } from "../api";
import { DomainPermissionEditor } from "../components/DomainPermissionEditor";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { downloadAgentBundle, getDefaultGatekeeperBaseUrl } from "../lib/agentBundle";
import {
  buildAccessSummary,
  groupsAreComplete,
  groupsToPermissions,
  permissionsToGroups,
  type PermissionGroup
} from "../lib/permissionGroups";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function summarizeClient(client: Client): string {
  const groups = permissionsToGroups(client.permissions);
  const summary = buildAccessSummary(groups);
  if (summary.serviceCount === 0 && summary.entityCount === 0) {
    return "No permissions";
  }
  return `${summary.domainCount} domains, ${summary.serviceCount} services, ${summary.entityCount} entities`;
}

export function TokensPage({
  clients,
  entities,
  services,
  issuedKey,
  onRotate,
  onDelete,
  onSavePermissions
}: {
  clients: Client[];
  entities: HaEntity[];
  services: HaServiceCatalog[];
  issuedKey: string | null;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onSavePermissions: (id: string, permissions: TokenPermission[]) => void;
}) {
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [draftGroups, setDraftGroups] = useState<PermissionGroup[]>([]);
  const [bundleErrorClientId, setBundleErrorClientId] = useState<string | null>(null);

  function handleDownloadBundle(client: Client): void {
    setBundleErrorClientId(null);

    try {
      downloadAgentBundle({
        clientName: client.name,
        baseUrl: getDefaultGatekeeperBaseUrl(),
        permissions: client.permissions,
        tokenMode: "placeholder"
      });
    } catch (error) {
      setBundleErrorClientId(client.id);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">Tokens</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Edit token permissions, rotate bearer tokens, or remove access.
        </p>
      </section>

      {issuedKey ? (
        <div className="rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] p-4 text-sm text-[var(--primary)]">
          New bearer token: <span className="font-mono">{issuedKey}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Issued tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-[var(--muted)]">
                    No tokens yet. Create one from Quick Start.
                  </TableCell>
                </TableRow>
              ) : null}
              {clients.map((client) => (
                <Fragment key={client.id}>
                  <TableRow>
                    <TableCell>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-xs text-[var(--muted)]">Created {formatDate(client.createdAt)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted)]">{summarizeClient(client)}</TableCell>
                    <TableCell>
                      <Badge variant={client.status === "active" ? "success" : "danger"}>
                        {client.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--muted)]">
                      {client.apiKeyPrefix}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Download bundle for ${client.name}`}
                          onClick={() => handleDownloadBundle(client)}
                        >
                          Download bundle
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingClientId(client.id);
                            setDraftGroups(permissionsToGroups(client.permissions));
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onRotate(client.id)}>
                          Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (confirm(`Delete token "${client.name}"? This cannot be undone.`)) {
                              onDelete(client.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                      {bundleErrorClientId === client.id ? (
                        <p className="mt-2 text-xs text-[var(--danger)]">
                          Could not create the placeholder bundle. Try again from this token row.
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  {editingClientId === client.id ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                          <DomainPermissionEditor
                            groups={draftGroups}
                            onChange={setDraftGroups}
                            entities={entities}
                            services={services}
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingClientId(null);
                                setDraftGroups([]);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              disabled={
                                groupsToPermissions(draftGroups).length === 0 ||
                                !groupsAreComplete(draftGroups)
                              }
                              onClick={() => {
                                onSavePermissions(client.id, groupsToPermissions(draftGroups));
                                setEditingClientId(null);
                                setDraftGroups([]);
                              }}
                            >
                              Save permissions
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
