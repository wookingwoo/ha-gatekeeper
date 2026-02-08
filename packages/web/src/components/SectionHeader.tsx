export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}
