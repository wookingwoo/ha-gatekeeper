import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QuickSetupResult, type TokenPermission } from "./api";
import { AuditTable } from "./components/AuditTable";
import { ClientTable } from "./components/ClientTable";
import { LoginCard } from "./components/LoginCard";
import { QuickSetup } from "./components/QuickSetup";
import { SectionHeader } from "./components/SectionHeader";
import { Button } from "./components/ui/button";

const tabs = ["Quick Start", "Tokens", "Activity"] as const;

type Tab = (typeof tabs)[number];

export default function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Quick Start");
  const [password, setPassword] = useState("");
  const [quickSetupResult, setQuickSetupResult] = useState<QuickSetupResult | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    staleTime: 1000 * 30
  });

  const authenticated = meQuery.data?.authenticated ?? false;

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
    enabled: authenticated
  });

  const entitiesQuery = useQuery({
    queryKey: ["ha-entities"],
    queryFn: () => api.haEntities(),
    enabled: authenticated
  });

  const loginMutation = useMutation({
    mutationFn: (pwd: string) => api.login(pwd),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
  });

  const quickSetupMutation = useMutation({
    mutationFn: api.quickSetup,
    onSuccess: (data) => {
      setQuickSetupResult(data);
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

  const updatePermissionsMutation = useMutation({
    mutationFn: ({
      clientId,
      permissions
    }: {
      clientId: string;
      permissions: TokenPermission[];
    }) =>
      api.updateClientPermissions(clientId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  });

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

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50">ha-gatekeeper</h1>
            <p className="text-sm text-slate-400">Manage Home Assistant token permissions</p>
          </div>
          <Button variant="secondary" onClick={() => logoutMutation.mutate()}>
            Log out
          </Button>
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

        {tab === "Quick Start" && (
          <div className="space-y-6">
            <SectionHeader
              title="Quick Start"
              subtitle="Create one token with only the controls and state reads it needs."
            />
            <QuickSetup
              entities={entitiesQuery.data?.entities ?? []}
              services={servicesQuery.data?.services ?? []}
              isLoadingEntities={entitiesQuery.isLoading || servicesQuery.isLoading}
              hasEntityError={entitiesQuery.isError || servicesQuery.isError}
              onRetryEntities={() => {
                entitiesQuery.refetch();
                servicesQuery.refetch();
              }}
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
              subtitle="Edit token permissions, rotate keys, or remove access."
            />
            {issuedKeyBanner}
            <ClientTable
              clients={clientsQuery.data?.clients ?? []}
              entities={entitiesQuery.data?.entities ?? []}
              services={servicesQuery.data?.services ?? []}
              onRotate={(clientId) => rotateKeyMutation.mutate(clientId)}
              onDelete={(clientId) => deleteClientMutation.mutate(clientId)}
              onSavePermissions={(clientId, permissions) =>
                updatePermissionsMutation.mutate({ clientId, permissions })
              }
            />
          </div>
        )}

        {tab === "Activity" && (
          <div className="space-y-6">
            <SectionHeader
              title="Activity"
              subtitle="Review recent allowed and denied service and state requests."
            />
            <AuditTable logs={auditQuery.data?.logs ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
