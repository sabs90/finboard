'use client';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
  formatter?: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const format = formatter ?? ((v: number) => String(v));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      {label && (
        <p className="text-xs text-slate-400 mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          {entry.color && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
          )}
          <span className="text-sm font-medium text-slate-100">
            {entry.name}: {format(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
