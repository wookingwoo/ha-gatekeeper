import { Client } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

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
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Key Prefix</TableHead>
              <TableHead>Rotate</TableHead>
              <TableHead>Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{client.name}</TableCell>
                <TableCell className="text-xs text-slate-400">{client.roleName}</TableCell>
                <TableCell>
                  <Badge variant={client.status === "active" ? "success" : "danger"}>
                    {client.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-400">
                  {client.apiKeyPrefix}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="secondary" onClick={() => onRotate(client.id)}>
                    Rotate
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete client \"${client.name}\"? This cannot be undone.`)) {
                        onDelete(client.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
