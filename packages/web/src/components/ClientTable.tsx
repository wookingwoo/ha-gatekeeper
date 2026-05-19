import { Fragment, useState } from "react";
import type { Client, HaEntity, HaServiceCatalog, TokenPermission } from "../api";
import { PermissionEditor } from "./PermissionEditor";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function summarizePermission(permission: TokenPermission): string {
  if (permission.kind === "state") {
    return `Read state: ${permission.entityIds.join(", ")}`;
  }
  return `${permission.domain}.${permission.services.join("|")} -> ${permission.entityIds.join(", ")}`;
}

export function ClientTable({
  clients,
  entities,
  services,
  onRotate,
  onDelete,
  onSavePermissions
}: {
  clients: Client[];
  entities: HaEntity[];
  services: HaServiceCatalog[];
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onSavePermissions: (id: string, permissions: TokenPermission[]) => void;
}) {
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<TokenPermission[]>([]);

  return (
    <Card className="glass">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  No tokens yet. Create one from Quick Start.
                </TableCell>
              </TableRow>
            ) : null}
            {clients.map((client) => (
              <Fragment key={client.id}>
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="font-medium text-slate-100">{client.name}</div>
                    <div className="text-xs text-slate-500">Created {formatDate(client.createdAt)}</div>
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-slate-400">
                    <div className="space-y-1">
                      {client.permissions.slice(0, 3).map((permission, index) => (
                        <div key={permission.id ?? index} className="truncate">
                          {summarizePermission(permission)}
                        </div>
                      ))}
                      {client.permissions.length > 3 ? (
                        <div>{client.permissions.length - 3} more</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === "active" ? "success" : "danger"}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {client.apiKeyPrefix}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingClientId(client.id);
                          setDraftPermissions(client.permissions);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => onRotate(client.id)}>
                        Rotate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete token "${client.name}"? This cannot be undone.`)) {
                            onDelete(client.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {editingClientId === client.id ? (
                  <TableRow key={`${client.id}-editor`}>
                    <TableCell colSpan={5}>
                      <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/40 p-4">
                        <PermissionEditor
                          permissions={draftPermissions}
                          onChange={setDraftPermissions}
                          entities={entities}
                          services={services}
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingClientId(null);
                              setDraftPermissions([]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              onSavePermissions(client.id, draftPermissions);
                              setEditingClientId(null);
                              setDraftPermissions([]);
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
  );
}
