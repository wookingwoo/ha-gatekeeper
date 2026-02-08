import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Action, Client, Role } from "./api";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Textarea } from "./components/ui/textarea";

const tabs = ["Overview", "Roles", "Actions", "Clients", "Audit"] as const;

type Tab = (typeof tabs)[number];

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState("");
  const [actionForm, setActionForm] = useState({
    id: "",
    name: "",
    description: "",
    status: "active" as const,
    roleIds: "",
    haCalls: ""
  });
  const [clientForm, setClientForm] = useState({
    name: "",
    roleId: "",
    status: "active" as const
  });
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    staleTime: 1000 * 30
  });

  const authenticated = meQuery.data?.authenticated ?? false;

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: api.roles,
    enabled: authenticated
  });

  const actionsQuery = useQuery({
    queryKey: ["actions"],
    queryFn: api.actions,
    enabled: authenticated
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: api.clients,
    enabled: authenticated
  });

  const auditQuery = useQuery({
    queryKey: ["audit"],
    queryFn: api.auditLogs,
    enabled: authenticated,
    refetchInterval: 15000
  });

  const loginMutation = useMutation({
    mutationFn: (pwd: string) => api.login(pwd),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
  });

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => api.createRole(name),
    onSuccess: () => {
      setRoleName("");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    }
  });

  const createActionMutation = useMutation({
    mutationFn: api.createAction,
    onSuccess: () => {
      setActionForm({ id: "", name: "", description: "", status: "active", roleIds: "", haCalls: "" });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
    }
  });

  const createClientMutation = useMutation({
    mutationFn: api.createClient,
    onSuccess: (data) => {
      setClientForm({ name: "", roleId: "", status: "active" });
      setIssuedKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  });

  const rotateKeyMutation = useMutation({
    mutationFn: api.rotateClientKey,
    onSuccess: (data) => {
      setIssuedKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  });

  const roleOptions = useMemo(() => rolesQuery.data?.roles ?? [], [rolesQuery.data]);

  if (!authenticated) {
    return (
      <div className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-md">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-2xl">ha-gatekeeper admin</CardTitle>
              <p className="text-sm text-slate-400">세션 기반 관리 콘솔 로그인</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => loginMutation.mutate(password)}
                disabled={loginMutation.isPending}
              >
                로그인
              </Button>
              {loginMutation.isError ? (
                <p className="text-sm text-rose-300">로그인 실패. 비밀번호를 확인하세요.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50">ha-gatekeeper</h1>
            <p className="text-sm text-slate-400">Home Assistant 액션 게이트웨이 관리</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => logoutMutation.mutate()}>
              로그아웃
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Button
              key={item}
              variant={tab === item ? "default" : "ghost"}
              onClick={() => setTab(item)}
            >
              {item}
            </Button>
          ))}
        </div>

        {tab === "Overview" && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>운영 개요</CardTitle>
              <p className="text-sm text-slate-400">
                활성 역할, 액션, 클라이언트 상태를 한눈에 확인합니다.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <StatCard title="Roles" value={roleOptions.length} />
              <StatCard title="Actions" value={actionsQuery.data?.actions.length ?? 0} />
              <StatCard title="Clients" value={clientsQuery.data?.clients.length ?? 0} />
            </CardContent>
          </Card>
        )}

        {tab === "Roles" && (
          <div className="space-y-6">
            <SectionHeader title="Roles" subtitle="액션 접근을 제어하는 역할을 정의합니다." />
            <Card className="glass">
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="role name"
                    value={roleName}
                    onChange={(event) => setRoleName(event.target.value)}
                  />
                  <Button
                    onClick={() => roleName && createRoleMutation.mutate(roleName)}
                    disabled={!roleName}
                  >
                    역할 생성
                  </Button>
                </div>
                <RoleTable roles={roleOptions} />
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "Actions" && (
          <div className="space-y-6">
            <SectionHeader
              title="Actions"
              subtitle="화이트리스트 기반으로 Home Assistant 서비스 호출을 구성합니다."
            />
            <Card className="glass">
              <CardContent className="space-y-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="action id"
                    value={actionForm.id}
                    onChange={(event) => setActionForm({ ...actionForm, id: event.target.value })}
                  />
                  <Input
                    placeholder="action name"
                    value={actionForm.name}
                    onChange={(event) => setActionForm({ ...actionForm, name: event.target.value })}
                  />
                  <Input
                    placeholder="description"
                    value={actionForm.description}
                    onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
                  />
                  <Input
                    placeholder="role ids (comma separated)"
                    value={actionForm.roleIds}
                    onChange={(event) => setActionForm({ ...actionForm, roleIds: event.target.value })}
                  />
                </div>
                <Textarea
                  placeholder='haCalls JSON e.g. [{"domain":"light","service":"turn_off","entityIds":["light.kitchen"]}]'
                  value={actionForm.haCalls}
                  onChange={(event) => setActionForm({ ...actionForm, haCalls: event.target.value })}
                />
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(actionForm.haCalls || "[]");
                        createActionMutation.mutate({
                          id: actionForm.id,
                          name: actionForm.name,
                          description: actionForm.description || undefined,
                          status: actionForm.status,
                          roleIds: actionForm.roleIds
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                          haCalls: parsed
                        });
                      } catch {
                        alert("haCalls must be valid JSON array");
                      }
                    }}
                    disabled={!actionForm.id || !actionForm.name || !actionForm.roleIds}
                  >
                    액션 생성
                  </Button>
                </div>
              </CardContent>
            </Card>
            <ActionTable actions={actionsQuery.data?.actions ?? []} />
          </div>
        )}

        {tab === "Clients" && (
          <div className="space-y-6">
            <SectionHeader
              title="Clients"
              subtitle="API Key 기반 클라이언트를 생성하고 키를 회전합니다."
            />
            <Card className="glass">
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="client name"
                    value={clientForm.name}
                    onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
                  />
                  <Input
                    placeholder="role id"
                    value={clientForm.roleId}
                    onChange={(event) => setClientForm({ ...clientForm, roleId: event.target.value })}
                  />
                  <Button
                    onClick={() =>
                      createClientMutation.mutate({
                        name: clientForm.name,
                        roleId: clientForm.roleId,
                        status: clientForm.status
                      })
                    }
                    disabled={!clientForm.name || !clientForm.roleId}
                  >
                    클라이언트 생성
                  </Button>
                </div>
                {issuedKey ? (
                  <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    신규 API Key: <span className="font-mono">{issuedKey}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <ClientTable
              clients={clientsQuery.data?.clients ?? []}
              onRotate={(clientId) => rotateKeyMutation.mutate(clientId)}
            />
          </div>
        )}

        {tab === "Audit" && (
          <div className="space-y-6">
            <SectionHeader
              title="Audit Logs"
              subtitle="모든 액션 요청을 시간순으로 추적합니다."
            />
            <AuditTable logs={auditQuery.data?.logs ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs uppercase text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function RoleTable({ roles }: { roles: Role[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell className="font-mono text-xs text-slate-400">{role.id}</TableCell>
            <TableCell>{role.name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ActionTable({ actions }: { actions: Action[] }) {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => (
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ClientTable({
  clients,
  onRotate
}: {
  clients: Client[];
  onRotate: (id: string) => void;
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AuditTable({ logs }: { logs: { id: string; timestamp: string; success: boolean; error?: string | null; ip?: string | null; clientName?: string | null; actionIdRaw: string; actionName?: string | null }[] }) {
  return (
    <Card className="glass">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Action</TableHead>
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
