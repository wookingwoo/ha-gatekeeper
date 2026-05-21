import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]",
        success: "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]",
        danger: "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
        warning: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
