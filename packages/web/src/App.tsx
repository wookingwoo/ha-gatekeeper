import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Action, Client, HaEntity, HaServiceCatalog, Role } from "./api";
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
    roleIds: [] as string[],
    calls: [
      {
        domain: "",
        service: "",
        entityIds: [] as string[],
        data: ""
      }
    ]
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

  const servicesQuery = useQuery({
    queryKey: ["ha-services"],
    queryFn: api.haServices,
    enabled: authenticated && tab === "Actions"
  });
  const haServices = servicesQuery.data?.services ?? [];
  const entitiesQuery = useQuery({
    queryKey: ["ha-entities"],
    queryFn: () => api.haEntities(),
    enabled: authenticated && tab === "Actions"
  });
  const haEntities = entitiesQuery.data?.entities ?? [];
  const serviceMap = useMemo(() => {
    const map = new Map<string, string[]>();
    haServices.forEach((entry) => map.set(entry.domain, entry.services));
    return map;
  }, [haServices]);
  const entityMap = useMemo(() => {
    const map = new Map<string, HaEntity[]>();
    haEntities.forEach((entity) => {
      const list = map.get(entity.domain) ?? [];
      list.push(entity);
      map.set(entity.domain, list);
    });
    return map;
  }, [haEntities]);

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
      setActionForm({
        id: "",
        name: "",
        description: "",
        status: "active",
        roleIds: [],
        calls: [{ domain: "", service: "", entityIds: [], data: "" }]
      });
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
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase text-slate-400">Allowed Roles</p>
                    <div className="mt-2 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
                      {roleOptions.map((role) => (
                        <label key={role.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400"
                            checked={actionForm.roleIds.includes(role.id)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...actionForm.roleIds, role.id]
                                : actionForm.roleIds.filter((id) => id !== role.id);
                              setActionForm({ ...actionForm, roleIds: next });
                            }}
                          />
                          <span className="text-xs text-slate-400">{role.id}</span>
                          <span>{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {actionForm.calls.map((call, index) => {
                    const servicesForDomain = call.domain
                      ? serviceMap.get(call.domain.trim()) ?? []
                      : [];
                    const entitiesForDomain = call.domain
                      ? entityMap.get(call.domain.trim()) ?? []
                      : [];

                    return (
                    <div key={`call-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <select
                            className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            value={call.domain}
                            onChange={(event) => {
                              const next = [...actionForm.calls];
                              next[index] = { ...next[index], domain: event.target.value, service: "" };
                              setActionForm({ ...actionForm, calls: next });
                            }}
                          >
                            <option value="">Select domain</option>
                            {haServices.map((entry) => (
                              <option key={entry.domain} value={entry.domain}>
                                {entry.domain}
                              </option>
                            ))}
                          </select>
                          <Input
                            placeholder="domain (manual override)"
                            value={call.domain}
                            onChange={(event) => {
                              const next = [...actionForm.calls];
                              next[index] = { ...next[index], domain: event.target.value };
                              setActionForm({ ...actionForm, calls: next });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <select
                            className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            value={call.service}
                            onChange={(event) => {
                              const next = [...actionForm.calls];
                              next[index] = { ...next[index], service: event.target.value };
                              setActionForm({ ...actionForm, calls: next });
                            }}
                            disabled={!call.domain}
                          >
                            <option value="">Select service</option>
                            {servicesForDomain.map((service) => (
                              <option key={service} value={service}>
                                {service}
                              </option>
                            ))}
                          </select>
                          <Input
                            placeholder="service (manual override)"
                            value={call.service}
                            onChange={(event) => {
                              const next = [...actionForm.calls];
                              next[index] = { ...next[index], service: event.target.value };
                              setActionForm({ ...actionForm, calls: next });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <select
                            multiple
                            className="h-28 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            value={call.entityIds}
                            onChange={(event) => {
                              const selected = Array.from(event.target.selectedOptions).map(
                                (option) => option.value
                              );
                              const next = [...actionForm.calls];
                              next[index] = { ...next[index], entityIds: selected };
                              setActionForm({ ...actionForm, calls: next });
                            }}
                            disabled={!call.domain}
                          >
                            {entitiesForDomain.map((entity) => (
                              <option key={entity.entityId} value={entity.entityId}>
                                {entity.name} ({entity.entityId})
                              </option>
                            ))}
                          </select>
                          <Input
                            placeholder="entity_id(s) comma separated"
                            value={call.entityIds.join(", ")}
                            onChange={(event) => {
                              const next = [...actionForm.calls];
                              const parsed = event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean);
                              next[index] = { ...next[index], entityIds: parsed };
                              setActionForm({ ...actionForm, calls: next });
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-slate-500">
                          HA service data JSON (optional). Example: {"{ \"brightness\": 120 }"}
                        </p>
                        <Textarea
                          placeholder='{"brightness":120}'
                          value={call.data}
                          onChange={(event) => {
                            const next = [...actionForm.calls];
                            next[index] = { ...next[index], data: event.target.value };
                            setActionForm({ ...actionForm, calls: next });
                          }}
                        />
                        {actionForm.calls.length > 1 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const next = actionForm.calls.filter((_, i) => i !== index);
                              setActionForm({ ...actionForm, calls: next });
                            }}
                          >
                            Remove call
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                  })}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setActionForm({
                        ...actionForm,
                        calls: [
                          ...actionForm.calls,
                          { domain: "", service: "", entityIds: [], data: "" }
                        ]
                      })
                    }
                  >
                    Add HA call
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      try {
                        const parsed = actionForm.calls.map((call) => {
                          if (!call.domain || !call.service) {
                            throw new Error("domain_service_required");
                          }
                          const entityIds = call.entityIds;
                          const data = call.data.trim() ? JSON.parse(call.data) : undefined;
                          return {
                            domain: call.domain.trim(),
                            service: call.service.trim(),
                            entityIds: entityIds.length > 0 ? entityIds : undefined,
                            data
                          };
                        });
                        createActionMutation.mutate({
                          id: actionForm.id,
                          name: actionForm.name,
                          description: actionForm.description || undefined,
                          status: actionForm.status,
                          roleIds: actionForm.roleIds,
                          haCalls: parsed
                        });
                      } catch {
                        alert("Each call requires domain/service and valid JSON for data");
                      }
                    }}
                    disabled={!actionForm.id || !actionForm.name || actionForm.roleIds.length === 0}
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
