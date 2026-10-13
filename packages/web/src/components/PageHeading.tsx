import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 className="text-[30px] font-semibold leading-[1.13] tracking-[-.055em] sm:text-[42px] xl:text-[46px]">
          {title}
        </h2>
        <p className="mt-3 max-w-lg text-xs leading-relaxed text-[var(--muted)] sm:text-[13px]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
