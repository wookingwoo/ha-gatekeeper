import type { AuditLog } from "../api";
import { Icon } from "./Icon";
import { Badge } from "./ui/badge";

export function ActivityTimeline({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {logs.map((log) => (
        <article key={log.id} className="py-4 first:pt-0 last:pb-0">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <time
              dateTime={log.timestamp}
              title={new Date(log.timestamp).toLocaleString()}
              className="text-xs text-[var(--muted)]"
            >
              {new Date(log.timestamp).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            <Badge variant={log.success ? "success" : "danger"}>
              {log.success ? "allowed" : "blocked"}
            </Badge>
          </div>
          <p className="break-all font-mono text-xs font-medium">
            {log.actionIdRaw}
          </p>
          <p className="mt-1.5 break-words text-xs text-[var(--muted)] [overflow-wrap:anywhere]">
            {log.clientName ?? "Unknown token"}
          </p>
          <details className="group mt-2">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
              Request details
              <Icon
                name="chevron"
                size={12}
                className="transition-transform group-open:rotate-180"
              />
            </summary>
            <dl className="grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
              <dt className="text-[var(--muted)]">Reason</dt>
              <dd className="break-words [overflow-wrap:anywhere]">
                {log.error ?? (log.success ? "Passed policy check" : "—")}
              </dd>
              <dt className="text-[var(--muted)]">IP address</dt>
              <dd className="break-all font-mono">{log.ip ?? "—"}</dd>
            </dl>
          </details>
        </article>
      ))}
    </div>
  );
}
