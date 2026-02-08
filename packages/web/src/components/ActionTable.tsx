import { Fragment, useState } from "react";
import { Action } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

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
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Curl</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => {
              const curl = `curl -X POST ${apiBase}/v1/actions/${action.id} -H \"X-API-Key: <API_KEY>\"`;
              const isOpen = openId === action.id;

              return (
                <Fragment key={action.id}>
                  <TableRow key={action.id}>
                    <TableCell className="font-mono text-xs text-slate-400">{action.id}</TableCell>
                    <TableCell>{action.name}</TableCell>
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
                      >
                        {isOpen ? "Hide" : "Show"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow key={`${action.id}-curl`}>
                      <TableCell colSpan={5} className="bg-slate-950/60">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <pre className="rounded-md border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-emerald-200">
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
