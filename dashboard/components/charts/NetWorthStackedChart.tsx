'use client';

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export interface NetWorthStackedPoint {
  date: string;
  property_equity: number;
  investment: number;
  cash: number;
  other_assets: number;
  net_worth: number;
}

function fmtK(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100_000_000) return `$${(cents / 100_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `$${(cents / 100_000).toFixed(0)}k`;
  return `$${(cents / 100).toFixed(0)}`;
}

function formatQuarter(date: string): string {
  const [year, month] = date.split('-');
  const q = Math.ceil(parseInt(month) / 3);
  return `Q${q} '${year.slice(2)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const LABELS: Record<string, string> = {
  property_equity: 'Property Equity',
  investment: 'Investments',
  cash: 'Cash',
  other_assets: 'Other',
  net_worth: 'Net Worth',
};

function StackedTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  // Show in reverse order (top of stack first)
  const items = [...payload].reverse().filter((p) => p.name !== 'net_worth');
  const nw = payload.find((p) => p.name === 'net_worth');
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 shadow-lg min-w-[180px]">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {items.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 text-xs mb-1">
          <span className="text-slate-400">{LABELS[p.name]}</span>
          <span className="font-medium" style={{ color: p.color }}>{fmtK(p.value)}</span>
        </div>
      ))}
      {nw && (
        <div className="flex justify-between gap-4 text-sm font-semibold mt-2 pt-2 border-t border-slate-700">
          <span className="text-slate-300">Net Worth</span>
          <span className={nw.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {fmtK(nw.value)}
          </span>
        </div>
      )}
    </div>
  );
}

export function NetWorthStackedChart({ data }: { data: NetWorthStackedPoint[] }) {
  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatQuarter}
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
          <Tooltip content={<StackedTooltip />} />
          <Area
            type="monotone"
            dataKey="other_assets"
            stackId="wealth"
            stroke="#F59E0B"
            fill="#F59E0B"
            fillOpacity={0.6}
            strokeWidth={0}
            name="other_assets"
          />
          <Area
            type="monotone"
            dataKey="cash"
            stackId="wealth"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.6}
            strokeWidth={0}
            name="cash"
          />
          <Area
            type="monotone"
            dataKey="investment"
            stackId="wealth"
            stroke="#10B981"
            fill="#10B981"
            fillOpacity={0.6}
            strokeWidth={0}
            name="investment"
          />
          <Area
            type="monotone"
            dataKey="property_equity"
            stackId="wealth"
            stroke="#8B5CF6"
            fill="#8B5CF6"
            fillOpacity={0.7}
            strokeWidth={0}
            name="property_equity"
          />
          <Line
            type="monotone"
            dataKey="net_worth"
            stroke="#ffffff"
            strokeWidth={2}
            dot={false}
            strokeDasharray="6 3"
            name="net_worth"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 justify-center mt-3">
        {[
          { color: '#8B5CF6', label: 'Property Equity' },
          { color: '#10B981', label: 'Investments' },
          { color: '#3B82F6', label: 'Cash' },
          { color: '#F59E0B', label: 'Other' },
          { color: '#ffffff', label: 'Net Worth', dashed: true },
        ].map(({ color, label, dashed }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
            {dashed ? (
              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" strokeDasharray="5 3" /></svg>
            ) : (
              <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
            )}
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
