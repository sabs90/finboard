import { Sparkline } from './Sparkline';

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  // `positive` controls colour (green/red). `direction` controls the arrow when
  // sentiment and direction differ (e.g. higher spending is "up" but "bad").
  trend?: { value: string; positive: boolean; direction?: 'up' | 'down' };
  // Optional mini trend line rendered in the top-right corner (oldest → newest).
  spark?: { values: number[]; color?: string };
}

export function KpiCard({ label, value, subtitle, trend, spark }: KpiCardProps) {
  const arrow = trend
    ? (trend.direction ?? (trend.positive ? 'up' : 'down')) === 'up' ? '↑' : '↓'
    : '';
  const showSpark = spark && spark.values.length >= 2;
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        {showSpark && (
          <div className="-mt-1 shrink-0">
            <Sparkline values={spark.values} color={spark.color} width={72} height={24} />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-100 tabular-nums">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      )}
      {trend && (
        <p className={`mt-1 text-sm font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {arrow} {trend.value}
        </p>
      )}
    </div>
  );
}
