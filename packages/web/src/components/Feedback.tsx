import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Button } from "./ui/button";

export function ErrorNotice({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]"
    >
      <Icon name="alert" size={18} className="shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <Icon name="refresh" size={14} />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
        <Icon name={icon} size={25} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
        {description}
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 py-16 text-sm text-[var(--muted)]"
    >
      <span className="loading-spinner" />
      {label}
    </div>
  );
}
