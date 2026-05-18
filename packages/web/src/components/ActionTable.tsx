import { Fragment, useState } from "react";
import { Action } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

function curlForPolicy(action: Action, apiBase: string): string {
  const policy = action.haCalls[0];
  if (!policy) {
    return "";
  }

  const body =
    policy.entityIds && policy.entityIds.length > 0
      ? JSON.stringify({ entity_id: policy.entityIds[0] })
      : "{}";

  return [
    `curl -X POST ${apiBase}/api/services/${policy.domain}/${policy.service}`,
    `  -H "Authorization: Bearer <GATEKEEPER_CLIENT_KEY>"`,
    `  -H "Content-Type: application/json"`,
    `  -d '${body}'`
  ].join(" \\\n");
}

export function ActionTable({ actions }: { actions: Action[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const apiBase =
    typeof window !== "undefined" && window.location.port === "5173"
      ? "http://localhost:8080"
      : typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:8080";

  return (
    <Card className="glass">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Targets</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Curl</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => {
              const policy = action.haCalls[0];
              const curl = curlForPolicy(action, apiBase);
              const isOpen = openId === action.id;
              const targets = policy?.allowNoEntity
                ? "entity-less"
                : `${policy?.entityIds?.length ?? 0} entities`;

              return (
                <Fragment key={action.id}>
                  <TableRow key={action.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{action.name}</span>
                        <span className="font-mono text-xs text-slate-500">{action.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {policy ? `${policy.domain}.${policy.service}` : "invalid policy"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{targets}</TableCell>
                    <TableCell>
                      <Badge variant={action.status === "active" ? "success" : "danger"}>
                        {action.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {action.roleIds.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setOpenId(isOpen ? null : action.id)}
                        disabled={!policy}
                      >
                        {isOpen ? "Hide" : "Show"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow key={`${action.id}-curl`}>
                      <TableCell colSpan={6} className="bg-slate-950/60">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-emerald-200">
                            {curl}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigator.clipboard.writeText(curl)}
                          >
                            Copy
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
