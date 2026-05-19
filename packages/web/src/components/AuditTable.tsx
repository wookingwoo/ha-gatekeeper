import { AuditLog } from "../api";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function AuditTable({ logs }: { logs: AuditLog[] }) {
  return (
    <Card className="glass">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  No activity yet.
                </TableCell>
              </TableRow>
            ) : null}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-slate-400">
                  {formatDate(log.timestamp)}
                </TableCell>
                <TableCell>
                  <div>{log.clientName ?? "Unknown token"}</div>
                  {log.ip ? <div className="text-xs text-slate-500">{log.ip}</div> : null}
                </TableCell>
                <TableCell>
                  <div className="font-mono text-xs text-slate-300">{log.actionIdRaw}</div>
                  {log.actionName ? (
                    <div className="text-xs text-slate-500">{log.actionName}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={log.success ? "success" : "danger"}>
                    {log.success ? "allowed" : "blocked"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {log.error ?? (log.success ? "Passed policy check" : "-")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
