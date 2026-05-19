import { Client } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function ClientTable({
  clients,
  onRotate,
  onDelete
}: {
  clients: Client[];
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="glass">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  No tokens yet. Create one from Quick Setup.
                </TableCell>
              </TableRow>
            ) : null}
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="font-medium text-slate-100">{client.name}</div>
                  <div className="text-xs text-slate-500">Created {formatDate(client.createdAt)}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-400">{client.roleName}</TableCell>
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
