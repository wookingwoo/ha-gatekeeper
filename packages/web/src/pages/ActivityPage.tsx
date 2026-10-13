import { useState } from "react";
import type { AuditLog } from "../api";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { EmptyState, ErrorNotice, LoadingState } from "../components/Feedback";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export function ActivityPage({
  logs,
  isLoading,
  hasError,
  onRetry,
}: {
  logs: AuditLog[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All requests");
  const allowed = logs.filter((log) => log.success).length;
  const blocked = logs.length - allowed;
  const unknown = logs.filter((log) => !log.clientName).length;
  const visible = logs.filter(
    (log) =>
      (filter === "All requests" ||
        (filter === "Allowed" ? log.success : !log.success)) &&
      `${log.clientName ?? "Unknown token"} ${log.actionIdRaw} ${log.error ?? ""} ${log.ip ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Stay informed"
        title="Activity"
        description="Every request tells a story. See what was allowed, what was blocked, and why."
      >
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
          Refreshes every 15 seconds
        </span>
      </PageHeading>
      {hasError ? (
        <ErrorNotice onRetry={onRetry}>
          Could not load activity. Please try again.
        </ErrorNotice>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            value: allowed,
            label: "Allowed requests",
            icon: "check" as const,
            description: "Passed your access rules",
            color: "text-[var(--primary)]",
            bg: "bg-[var(--primary-soft)]",
          },
          {
            value: blocked,
            label: "Blocked requests",
            icon: "shield" as const,
            description: "Denied or failed requests",
            color: "text-[var(--danger)]",
            bg: "bg-[var(--danger-soft)]",
          },
          {
            value: unknown,
            label: "Unknown tokens",
            icon: "key" as const,
            description: "Requests without a recognized token",
            color: "text-[var(--muted)]",
            bg: "bg-[var(--surface-muted)]",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-start justify-between gap-3 p-5 sm:p-6">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {isLoading || (hasError && !logs.length) ? "—" : stat.value}
                </p>
                <p className="mt-2 text-[10px] text-[var(--muted)]">
                  {stat.description}
                </p>
              </div>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}
              >
                <Icon name={stat.icon} size={18} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5 sm:px-6">
          <div>
            <h3 className="text-base font-semibold">Audit log</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Recent gateway requests
            </p>
          </div>
          <Badge>{logs.length} requests</Badge>
        </div>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="search-field">
              <Icon name="search" size={17} />
              <Input
                type="search"
                aria-label="Search activity"
                placeholder="Search token, action, or IP…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <div
              role="group"
              aria-label="Filter activity"
              className="flex rounded-xl bg-[var(--surface-muted)] p-1"
            >
              {["All requests", "Allowed", "Blocked"].map((value) => (
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
            <LoadingState label="Loading activity…" />
          ) : !visible.length ? (
            hasError && !logs.length ? null : (
              <EmptyState
                icon="activity"
                title={logs.length ? "No matching activity" : "No activity yet"}
                description={
                  logs.length
                    ? "Try another search or view all requests."
                    : "When a token is used, its requests and results will appear here."
                }
              >
                {logs.length ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setFilter("All requests");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </EmptyState>
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-[var(--muted)]">
                      <time dateTime={log.timestamp}>
                        {new Date(log.timestamp).toLocaleString()}
                      </time>
                    </TableCell>
                    <TableCell className="min-w-[140px] text-xs font-medium">
                      {log.clientName ?? "Unknown token"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.actionIdRaw}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.success ? "success" : "danger"}>
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {log.success ? "allowed" : "blocked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[140px] text-xs text-[var(--muted)]">
                      {log.error ?? (log.success ? "Passed policy check" : "—")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[10px] text-[var(--muted)]">
                      {log.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p role="status" className="mt-4 text-[10px] text-[var(--muted)]">
            Showing {visible.length} of {logs.length} recent requests
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
