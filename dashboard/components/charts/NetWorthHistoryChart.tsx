'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface DataPoint {
  date: string;
  net_worth: number;
  total_assets: number;
  mortgage: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}

function fmtK(cents: number): string {
  const k = cents / 100_000;
  return `$${k.toFixed(0)}k`;
}

function formatLabel(date: string): string {
  const [, m] = date.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m, 10) - 1];
}

function NwTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const labelMap: Record<string, string> = {
    net_worth: 'Net Worth',
    total_assets: 'Total Assets',
    mortgage: 'Mortgage',
  };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-sm">
          <span className="text-slate-400">{labelMap[p.dataKey] ?? p.dataKey}</span>
          <span className="font-semibold" style={{ color: p.color }}>
            {fmtK(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function NetWorthHistoryChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatLabel}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<NwTooltip />} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="total_assets"
            stroke="#3B82F6"
            strokeWidth={1.5}
            dot={false}
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="mortgage"
            stroke="#EF4444"
            strokeWidth={1.5}
            dot={false}
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="net_worth"
            stroke="#10B981"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-6 justify-center mt-2">
        {[
          { color: '#10B981', label: 'Net Worth' },
          { color: '#3B82F6', label: 'Total Assets' },
          { color: '#EF4444', label: 'Mortgage' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
