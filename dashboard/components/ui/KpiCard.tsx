interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
}

export function KpiCard({ label, value, subtitle, trend }: KpiCardProps) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-100 tabular-nums">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      )}
      {trend && (
        <p className={`mt-1 text-sm font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend.positive ? '\u2191' : '\u2193'} {trend.value}
        </p>
      )}
    </div>
  );
}
