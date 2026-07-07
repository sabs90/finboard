'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { MortgageHistoryPoint } from '@/lib/db';
import { SEMANTIC } from '@/lib/chartColors';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}

function fmtK(cents: number): string {
  const k = cents / 100_000;
  if (Math.abs(k) >= 1000) return `$${(k / 1000).toFixed(2)}M`;
  return `$${k.toFixed(0)}k`;
}

function fmtTick(date: string): string {
  const [y, m] = date.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function HistoryTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const labelMap: Record<string, string> = {
    loanCents: 'Loan balance',
    offsetCents: 'Offset balance',
  };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg min-w-[170px]">
      <p className="text-xs text-slate-400 mb-1.5">{fmtTick(label)}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-sm">
          <span className="text-slate-400">{labelMap[p.dataKey] ?? p.dataKey}</span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {fmtK(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MortgageHistoryChart({ data }: { data: MortgageHistoryPoint[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtTick}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 8) - 1)}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<HistoryTooltip />} />
          <Line type="monotone" dataKey="loanCents" stroke={SEMANTIC.debt} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="offsetCents" stroke={SEMANTIC.income} strokeWidth={1.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-6 justify-center mt-2">
        {[
          { color: SEMANTIC.debt, label: 'Loan balance' },
          { color: SEMANTIC.income, label: 'Offset balance' },
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
