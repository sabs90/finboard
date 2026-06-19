'use client';

import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

export interface WaterfallCategory {
  name: string;
  value: number; // positive spend (cents)
  color: string;
}

interface WaterfallProps {
  incomeCents: number;
  categories: WaterfallCategory[];
  netCents: number;
}

interface Step {
  name: string;
  base: number;   // invisible offset (cents)
  value: number;  // visible bar height (cents)
  delta: number;  // signed change for the tooltip
  color: string;
  kind: 'income' | 'expense' | 'net';
}

const INCOME_COLOR = '#10B981';
const NET_POS_COLOR = '#3B82F6';
const NET_NEG_COLOR = '#F43F5E';

function buildSteps({ incomeCents, categories, netCents }: WaterfallProps): Step[] {
  const steps: Step[] = [
    { name: 'Income', base: 0, value: incomeCents, delta: incomeCents, color: INCOME_COLOR, kind: 'income' },
  ];

  let running = incomeCents;
  for (const c of categories) {
    steps.push({
      name: c.name,
      base: running - c.value,
      value: c.value,
      delta: -c.value,
      color: c.color,
      kind: 'expense',
    });
    running -= c.value;
  }

  // Net "total" bar grounded at zero (sits below the axis if negative).
  steps.push({
    name: 'Net',
    base: Math.min(0, netCents),
    value: Math.abs(netCents),
    delta: netCents,
    color: netCents >= 0 ? NET_POS_COLOR : NET_NEG_COLOR,
    kind: 'net',
  });

  return steps;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Step }>;
}

function WaterfallTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-400 mb-1">{s.name}</p>
      <p className="text-sm font-medium text-slate-100 tabular-nums">
        {s.delta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(s.delta))}
      </p>
    </div>
  );
}

function formatYAxis(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

export function CashflowWaterfall(props: WaterfallProps) {
  const steps = buildSteps(props);

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={steps} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<WaterfallTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
          {/* Invisible base lifts each floating bar to its running total. */}
          <Bar dataKey="base" stackId="w" fill="transparent" />
          <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]}>
            {steps.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
