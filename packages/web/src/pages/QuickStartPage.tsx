import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HaEntity,
  HaServiceCatalog,
  QuickSetupPayload,
  QuickSetupResult,
} from "../api";
import { AccessSummary } from "../components/AccessSummary";
import { DomainPermissionEditor } from "../components/DomainPermissionEditor";
import { PermissionReview } from "../components/PermissionReview";
import { TokenIssued } from "../components/TokenIssued";
import { HomeAssistantHelpDialog } from "../components/HomeAssistantHelpDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  buildAccessSummary,
  createDefaultGroups,
  groupsAreComplete,
  groupsToPermissions,
} from "../lib/permissionGroups";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { ErrorNotice } from "../components/Feedback";

export function QuickStartPage({
  entities,
  services,
  isLoadingEntities,
  hasEntityError,
  onRetryEntities,
  onCreate,
  result,
  onClearResult,
  isSubmitting,
  hasSubmitError,
}: {
  entities: HaEntity[];
  services: HaServiceCatalog[];
  isLoadingEntities: boolean;
  hasEntityError: boolean;
  onRetryEntities: () => void;
  onCreate: (payload: QuickSetupPayload) => void;
  result: QuickSetupResult | null;
  onClearResult: () => void;
  isSubmitting: boolean;
  hasSubmitError: boolean;
}) {
  const [name, setName] = useState("");
  const [groups, setGroups] = useState(createDefaultGroups);
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [helpOpen, setHelpOpen] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const configureHeading = useRef<HTMLHeadingElement>(null);
  const hasReviewed = useRef(false);
  const permissions = useMemo(() => groupsToPermissions(groups), [groups]);
  const summary = buildAccessSummary(groups);
  const canSubmit =
    Boolean(name.trim()) &&
    permissions.length > 0 &&
    groupsAreComplete(groups) &&
    !isLoadingEntities &&
    !hasEntityError;

  useEffect(() => {
    if (result) return;
    if (step === "review") {
      hasReviewed.current = true;
      reviewHeading.current?.focus();
    } else if (hasReviewed.current)
      configureHeading.current?.focus({ preventScroll: true });
  }, [step, result]);

  if (result)
    return (
      <TokenIssued
        result={result}
        onCreateAnother={() => {
          setName("");
          setGroups(createDefaultGroups());
          setStep("configure");
          onClearResult();
        }}
      />
    );

  return (
    <div className="space-y-5 sm:space-y-7">
      <PageHeading
        eyebrow="01 / Access studio"
        title="Create scoped access"
        description="Open the right doors. Give every person and agent a key with just the access they need."
      />
      {hasSubmitError ? (
        <ErrorNotice>
          Could not issue token. Your selections are saved here. Please try
          again.
        </ErrorNotice>
      ) : null}
      {isLoadingEntities ? (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-[var(--muted)]"
        >
          <span className="loading-spinner" />
          Loading Home Assistant services and entities…
        </p>
      ) : null}
      {hasEntityError ? (
        <ErrorNotice onRetry={onRetryEntities}>
          <p className="font-semibold">Cannot load Home Assistant data</p>
          <p className="mt-1">Check the Home Assistant connection and retry.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHelpOpen(true)}
            className="mt-2"
          >
            Open token guide
          </Button>
        </ErrorNotice>
      ) : null}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="studio-panel">
          <ol
            aria-label="Token setup steps"
            className="flex items-center gap-5 border-b border-[var(--border)] px-4 py-2 sm:px-6"
          >
            <li
              className="setup-step"
              aria-current={step === "configure" ? "step" : undefined}
            >
              <span className="setup-step-number">
                {step === "review" ? <Icon name="check" size={12} /> : "01"}
              </span>
              <span>Configure access</span>
            </li>
            <li aria-hidden="true" className="text-[var(--border)]">
              <Icon name="arrow" size={14} />
            </li>
            <li
              className="setup-step"
              aria-current={step === "review" ? "step" : undefined}
            >
              <span className="setup-step-number">02</span>
              <span>Review & issue</span>
            </li>
          </ol>
          {step === "configure" ? (
            <>
              <h3 ref={configureHeading} tabIndex={-1} className="sr-only">
                Access settings
              </h3>
              <div className="space-y-5 p-4 sm:p-6">
                <div className="space-y-2">
                  <label htmlFor="token-name" className="field-label">
                    Token name
                  </label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Living room agent"
                    disabled={isSubmitting}
                    maxLength={80}
                  />
                </div>
                <DomainPermissionEditor
                  groups={groups}
                  onChange={setGroups}
                  entities={entities}
                  services={services}
                  disabled={isSubmitting || isLoadingEntities || hasEntityError}
                />
              </div>
              <div className="setup-actions">
                <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                  {canSubmit
                    ? `${summary.entityCount} entities · ${summary.serviceCount} services selected`
                    : "Name your key and choose its access."}
                </p>
                <Button
                  className="ml-auto"
                  disabled={!canSubmit}
                  onClick={() => setStep("review")}
                >
                  Review access
                  <Icon name="arrow" size={15} />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-5 p-4 sm:p-6">
                <div>
                  <h3
                    ref={reviewHeading}
                    tabIndex={-1}
                    className="text-xl font-semibold tracking-tight outline-none"
                  >
                    Review your access
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    Check the scope below. Everything else stays out of reach.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <Icon
                    name="key"
                    size={19}
                    className="shrink-0 text-[var(--primary)]"
                  />
                  <div className="min-w-0">
                    <p className="studio-label">Token name</p>
                    <p className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">
                      {name}
                    </p>
                  </div>
                </div>
                <PermissionReview groups={groups} entities={entities} />
                <p className="flex items-start gap-2 border-t border-[var(--border)] pt-4 text-[11px] leading-relaxed text-[var(--muted)]">
                  <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
                  Your token appears once. Keep it private. Area, device, floor,
                  and label targets remain blocked.
                </p>
              </div>
              <div className="setup-actions">
                <Button
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => setStep("configure")}
                >
                  <Icon name="arrow" size={14} className="rotate-180" />
                  Edit access
                </Button>
                <Button
                  disabled={!canSubmit || isSubmitting}
                  onClick={() => onCreate({ name: name.trim(), permissions })}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading-spinner" />
                      Issuing token…
                    </>
                  ) : (
                    <>
                      Issue token
                      <Icon name="key" size={15} />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
        <AccessSummary groups={groups} tokenName={name} />
      </div>
      {helpOpen ? (
        <HomeAssistantHelpDialog onClose={() => setHelpOpen(false)} />
      ) : null}
    </div>
  );
}
