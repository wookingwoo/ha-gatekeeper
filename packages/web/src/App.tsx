import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type ApiError,
  type QuickSetupResult,
  type TokenPermission,
} from "./api";
import { AppShell, type Tab } from "./components/AppShell";
import { LoginCard } from "./components/LoginCard";
import { ActivityPage } from "./pages/ActivityPage";
import { QuickStartPage } from "./pages/QuickStartPage";
import { TokensPage } from "./pages/TokensPage";
import { ErrorNotice, LoadingState } from "./components/Feedback";

export default function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Quick Start");
  const [password, setPassword] = useState("");
  const [quickSetupResult, setQuickSetupResult] =
    useState<QuickSetupResult | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    staleTime: 1000 * 30,
    retry: 1,
  });

  const authenticated = meQuery.data?.authenticated ?? false;

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: api.clients,
    enabled: authenticated,
  });

  const auditQuery = useQuery({
    queryKey: ["audit"],
    queryFn: api.auditLogs,
    enabled: authenticated,
    refetchInterval: 15000,
  });

  const servicesQuery = useQuery({
    queryKey: ["ha-services"],
    queryFn: api.haServices,
    enabled: authenticated,
  });

  const entitiesQuery = useQuery({
    queryKey: ["ha-entities"],
    queryFn: () => api.haEntities(),
    enabled: authenticated,
  });

  const loginMutation = useMutation<{}, ApiError, string>({
    mutationFn: (pwd: string) => api.login(pwd),
    onSuccess: () => {
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      setQuickSetupResult(null);
      setIssuedKey(null);
      setTab("Quick Start");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const quickSetupMutation = useMutation({
    mutationFn: api.quickSetup,
    onSuccess: (data) => {
      setQuickSetupResult(data);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: api.rotateClientKey,
    onSuccess: (data) => {
      setIssuedKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: api.deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({
      clientId,
      permissions,
    }: {
      clientId: string;
      permissions: TokenPermission[];
    }) => api.updateClientPermissions(clientId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Opening your workspace…" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div>
        {meQuery.isError ? (
          <div className="p-4">
            <ErrorNotice onRetry={() => meQuery.refetch()}>
              Cannot reach the access console. Check your connection and try
              again.
            </ErrorNotice>
          </div>
        ) : null}
        <LoginCard
          password={password}
          onPasswordChange={setPassword}
          onSubmit={() => loginMutation.mutate(password)}
          isSubmitting={loginMutation.isPending}
          error={loginMutation.error}
        />
      </div>
    );
  }

  const haStatus =
    entitiesQuery.isError || servicesQuery.isError
      ? "error"
      : entitiesQuery.isLoading || servicesQuery.isLoading
        ? "loading"
        : "connected";

  return (
    <AppShell
      activeTab={tab}
      onTabChange={setTab}
      onLogout={() => logoutMutation.mutate()}
      isLoggingOut={logoutMutation.isPending}
      haStatus={haStatus}
    >
      {logoutMutation.isError ? (
        <div className="mb-5">
          <ErrorNotice>Could not log out. Please try again.</ErrorNotice>
        </div>
      ) : null}
      {tab === "Quick Start" ? (
        <QuickStartPage
          publicApiBaseUrl={meQuery.data?.publicApiBaseUrl}
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
          onClearResult={() => {
            setQuickSetupResult(null);
            quickSetupMutation.reset();
          }}
          isSubmitting={quickSetupMutation.isPending}
          hasSubmitError={quickSetupMutation.isError}
        />
      ) : null}

      {tab === "Tokens" ? (
        <TokensPage
          publicApiBaseUrl={meQuery.data?.publicApiBaseUrl}
          clients={clientsQuery.data?.clients ?? []}
          entities={entitiesQuery.data?.entities ?? []}
          services={servicesQuery.data?.services ?? []}
          issuedKey={issuedKey}
          isLoading={clientsQuery.isLoading}
          hasError={clientsQuery.isError}
          onRetry={() => clientsQuery.refetch()}
          onCreate={() => {
            setQuickSetupResult(null);
            quickSetupMutation.reset();
            setTab("Quick Start");
          }}
          isMutating={
            rotateKeyMutation.isPending ||
            deleteClientMutation.isPending ||
            updatePermissionsMutation.isPending
          }
          mutationError={
            rotateKeyMutation.isError
              ? "Could not rotate token. Please try again."
              : deleteClientMutation.isError
                ? "Could not delete token. Please try again."
                : updatePermissionsMutation.isError
                  ? "Could not save permissions. Please try again."
                  : null
          }
          canEditPermissions={
            !entitiesQuery.isLoading &&
            !servicesQuery.isLoading &&
            !entitiesQuery.isError &&
            !servicesQuery.isError
          }
          onRotate={(clientId) => {
            deleteClientMutation.reset();
            updatePermissionsMutation.reset();
            rotateKeyMutation.mutate(clientId);
          }}
          onDelete={(clientId) => {
            rotateKeyMutation.reset();
            updatePermissionsMutation.reset();
            deleteClientMutation.mutate(clientId);
          }}
          onSavePermissions={(clientId, permissions) => {
            rotateKeyMutation.reset();
            deleteClientMutation.reset();
            return updatePermissionsMutation
              .mutateAsync({ clientId, permissions })
              .then(() => undefined);
          }}
        />
      ) : null}

      {tab === "Activity" ? (
        <ActivityPage
          logs={auditQuery.data?.logs ?? []}
          isLoading={auditQuery.isLoading}
          hasError={auditQuery.isError}
          onRetry={() => auditQuery.refetch()}
        />
      ) : null}
    </AppShell>
  );
}
