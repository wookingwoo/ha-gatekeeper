import type { AuditLog } from "../api";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function ActivityPage({ logs }: { logs: AuditLog[] }) {
  const allowed = logs.filter((log) => log.success).length;
  const blocked = logs.filter((log) => !log.success).length;
  const unknown = logs.filter((log) => !log.clientName).length;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">Activity</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Review recent allowed and denied service and state requests.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{allowed}</p>
            <p className="text-sm text-[var(--muted)]">Allowed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{blocked}</p>
            <p className="text-sm text-[var(--muted)]">Blocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{unknown}</p>
            <p className="text-sm text-[var(--muted)]">Unknown token</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-[var(--muted)]">
                    No activity yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-[var(--muted)]">{formatDate(log.timestamp)}</TableCell>
                  <TableCell>{log.clientName ?? "Unknown token"}</TableCell>
                  <TableCell className="font-mono text-xs">{log.actionIdRaw}</TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "success" : "danger"}>
                      {log.success ? "allowed" : "blocked"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[var(--muted)]">
                    {log.error ?? (log.success ? "Passed policy check" : "-")}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--muted)]">{log.ip ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
