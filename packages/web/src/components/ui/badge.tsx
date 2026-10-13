import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]",
        success:
          "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--success)]",
        danger:
          "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
        warning:
          "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
