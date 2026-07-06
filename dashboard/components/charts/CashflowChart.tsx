'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { formatCurrency, formatMonth } from '@/lib/formatters';
import { SEMANTIC } from '@/lib/chartColors';

export interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}

function CashflowTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-400 mb-1">{formatMonth(label)}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-sm font-medium text-slate-100">
            {entry.name}: {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatYAxis(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return months[parseInt(m.split('-')[1], 10) - 1];
            }}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CashflowTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
          />
          <Bar name="Income" dataKey="income" fill={SEMANTIC.income} radius={[4, 4, 0, 0]} />
          <Bar name="Expenses" dataKey="expense" fill={SEMANTIC.expense} radius={[4, 4, 0, 0]} />
          <Line name="Net" type="monotone" dataKey="net" stroke={SEMANTIC.net} strokeWidth={2} dot={{ r: 3, fill: SEMANTIC.net }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
