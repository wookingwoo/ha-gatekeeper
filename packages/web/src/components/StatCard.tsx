export function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs uppercase text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}
