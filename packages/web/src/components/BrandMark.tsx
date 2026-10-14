import type { SVGProps } from "react";

export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M9 32V17C9 10.9 13.9 6 20 6s11 4.9 11 11v15"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M16 32V17c0-2.2 1.8-4 4-4s4 1.8 4 4v15"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path d="M6 32h28" stroke="currentColor" strokeWidth="3" />
      <circle cx="20" cy="24" r="1.8" fill="currentColor" />
    </svg>
  );
}
