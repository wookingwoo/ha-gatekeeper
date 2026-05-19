import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type HaEntity, type QuickSetupResult } from "./api";
import { ActionBuilder } from "./components/ActionBuilder";
import { ActionTable } from "./components/ActionTable";
import { AuditTable } from "./components/AuditTable";
import { ClientTable } from "./components/ClientTable";
import { LoginCard } from "./components/LoginCard";
import { QuickSetup } from "./components/QuickSetup";
import { RoleTable } from "./components/RoleTable";
import { SectionHeader } from "./components/SectionHeader";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { ActionFormState, ClientFormState } from "./types";

const tabs = ["Quick Setup", "Tokens", "Activity", "Advanced"] as const;
const advancedTabs = ["Roles", "Service Policies", "Clients", "Audit Logs"] as const;

type Tab = (typeof tabs)[number];
type AdvancedTab = (typeof advancedTabs)[number];

export default function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Quick Setup");
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>("Service Policies");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState("");
  const [quickSetupResult, setQuickSetupResult] = useState<QuickSetupResult | null>(null);
  const [actionForm, setActionForm] = useState<ActionFormState>({
    id: "",
    name: "",
    description: "",
    status: "active" as const,
    roleIds: [] as string[],
    call: {
      domain: "",
      service: "",
      entityIds: [] as string[],
      allowNoEntity: false
    }
  });
  const [clientForm, setClientForm] = useState<ClientFormState>({
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
    enabled: authenticated && tab === "Advanced" && advancedTab === "Service Policies"
  });
  const haServices = servicesQuery.data?.services ?? [];
  const entitiesQuery = useQuery({
    queryKey: ["ha-entities"],
    queryFn: () => api.haEntities(),
    enabled:
      authenticated &&
      (tab === "Quick Setup" || (tab === "Advanced" && advancedTab === "Service Policies"))
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
        call: { domain: "", service: "", entityIds: [], allowNoEntity: false }
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

  const quickSetupMutation = useMutation({
    mutationFn: api.quickSetup,
    onSuccess: (data) => {
      setQuickSetupResult(data);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
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

  const deleteClientMutation = useMutation({
    mutationFn: api.deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  });

  const roleOptions = useMemo(() => rolesQuery.data?.roles ?? [], [rolesQuery.data]);

  if (!authenticated) {
    return (
      <div className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-md">
          <LoginCard
            password={password}
            onPasswordChange={setPassword}
            onSubmit={() => loginMutation.mutate(password)}
            isSubmitting={loginMutation.isPending}
            hasError={loginMutation.isError}
          />
        </div>
      </div>
    );
  }

  const issuedKeyBanner = issuedKey ? (
    <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
      New bearer token: <span className="font-mono">{issuedKey}</span>
    </div>
  ) : null;

  const renderRolesView = () => (
    <div className="space-y-6">
      <SectionHeader title="Roles" subtitle="Define roles that control service access." />
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
              Create role
            </Button>
          </div>
          <RoleTable roles={roleOptions} />
        </CardContent>
      </Card>
    </div>
  );

  const renderServicePoliciesView = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Service Policies"
        subtitle="Allow Home Assistant service endpoints by role and entity."
      />
      <Card className="glass">
        <CardContent>
          <ActionBuilder
            actionForm={actionForm}
            setActionForm={setActionForm}
            roleOptions={roleOptions}
            serviceMap={serviceMap}
            entityMap={entityMap}
            onCreate={() => {
              const call = actionForm.call;
              createActionMutation.mutate({
                id: actionForm.id || undefined,
                name: actionForm.name,
                description: actionForm.description || undefined,
                status: actionForm.status,
                roleIds: actionForm.roleIds,
                haCalls: [
                  {
                    domain: call.domain.trim(),
                    service: call.service.trim(),
                    entityIds: call.entityIds.length > 0 ? call.entityIds : undefined,
                    allowNoEntity: call.allowNoEntity
                  }
                ]
              });
            }}
            isDisabled={
              !actionForm.name ||
              !actionForm.call.domain ||
              !actionForm.call.service ||
              actionForm.roleIds.length === 0 ||
              (!actionForm.call.allowNoEntity && actionForm.call.entityIds.length === 0)
            }
          />
        </CardContent>
      </Card>
      <ActionTable actions={actionsQuery.data?.actions ?? []} />
    </div>
  );

  const renderAdvancedClientsView = () => (
    <div className="space-y-6">
      <SectionHeader title="Clients" subtitle="Create bearer token clients and rotate keys." />
      <Card className="glass">
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="client name"
              value={clientForm.name}
              onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
            />
            <select
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              value={clientForm.roleId}
              onChange={(event) => setClientForm({ ...clientForm, roleId: event.target.value })}
            >
              <option value="">Select role</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.id})
                </option>
              ))}
            </select>
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
              Create client
            </Button>
          </div>
          {issuedKeyBanner}
        </CardContent>
      </Card>
      <ClientTable
        clients={clientsQuery.data?.clients ?? []}
        onRotate={(clientId) => rotateKeyMutation.mutate(clientId)}
        onDelete={(clientId) => deleteClientMutation.mutate(clientId)}
      />
    </div>
  );

  const renderAuditLogsView = () => <AuditTable logs={auditQuery.data?.logs ?? []} />;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50">ha-gatekeeper</h1>
            <p className="text-sm text-slate-400">Manage Home Assistant service access</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => logoutMutation.mutate()}>
              Log out
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

        {tab === "Quick Setup" && (
          <div className="space-y-6">
            <SectionHeader
              title="Quick Setup"
              subtitle="Create scoped Home Assistant access in a guided flow."
            />
            <QuickSetup
              entities={haEntities}
              isLoadingEntities={entitiesQuery.isLoading}
              hasEntityError={entitiesQuery.isError}
              onRetryEntities={() => entitiesQuery.refetch()}
              onCreate={(payload) => quickSetupMutation.mutate(payload)}
              result={quickSetupResult}
              isSubmitting={quickSetupMutation.isPending}
            />
          </div>
        )}

        {tab === "Tokens" && (
          <div className="space-y-6">
            <SectionHeader
              title="Tokens"
              subtitle="Manage issued bearer tokens and rotate access when needed."
            />
            {issuedKeyBanner}
            <ClientTable
              clients={clientsQuery.data?.clients ?? []}
              onRotate={(clientId) => rotateKeyMutation.mutate(clientId)}
              onDelete={(clientId) => deleteClientMutation.mutate(clientId)}
            />
          </div>
        )}

        {tab === "Activity" && (
          <div className="space-y-6">
            <SectionHeader
              title="Activity"
              subtitle="Review recent allowed and denied Home Assistant service calls."
            />
            <AuditTable logs={auditQuery.data?.logs ?? []} />
          </div>
        )}

        {tab === "Advanced" && (
          <div className="space-y-6">
            <SectionHeader
              title="Advanced"
              subtitle="Inspect and edit roles, service policies, clients, and raw audit logs."
            />
            <div className="flex flex-wrap gap-2">
              {advancedTabs.map((item) => (
                <Button
                  key={item}
                  variant={advancedTab === item ? "default" : "ghost"}
                  onClick={() => setAdvancedTab(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            {advancedTab === "Roles" ? renderRolesView() : null}
            {advancedTab === "Service Policies" ? renderServicePoliciesView() : null}
            {advancedTab === "Clients" ? renderAdvancedClientsView() : null}
            {advancedTab === "Audit Logs" ? renderAuditLogsView() : null}
          </div>
        )}
      </div>
    </div>
  );
}
