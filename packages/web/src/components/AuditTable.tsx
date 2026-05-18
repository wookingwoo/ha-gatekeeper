import { AuditLog } from "../api";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export function AuditTable({ logs }: { logs: AuditLog[] }) {
  return (
    <Card className="glass">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>{log.clientName ?? "-"}</TableCell>
                <TableCell className="text-xs text-slate-400">
                  {log.actionName ?? log.actionIdRaw}
                </TableCell>
                <TableCell>
                  <Badge variant={log.success ? "success" : "danger"}>
                    {log.success ? "ok" : "fail"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-400">{log.error ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
