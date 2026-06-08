'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency, formatMonth } from '@/lib/formatters';

type StackedTrendData = Record<string, string | number>;

interface SubcategoryInfo {
  name: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function StackedTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
      <p className="text-xs text-slate-400 mb-1.5">{formatMonth(label)}</p>
      {sorted.map((entry) => (
        entry.value > 0 && (
          <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-slate-300">{entry.name}</span>
            </div>
            <span className="text-xs font-medium text-slate-100 tabular-nums">
              {formatCurrency(entry.value)}
            </span>
          </div>
        )
      ))}
      <div className="border-t border-slate-700 mt-1 pt-1 flex justify-between">
        <span className="text-xs text-slate-400">Total</span>
        <span className="text-xs font-semibold text-slate-100 tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function formatYAxis(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

export function StackedTrendChart({
  data,
  subcategories,
}: {
  data: StackedTrendData[];
  subcategories: SubcategoryInfo[];
}) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => {
              const parts = m.split('-');
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return months[parseInt(parts[1], 10) - 1];
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
          <Tooltip content={<StackedTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingTop: '8px' }}
            formatter={(value: string) => (
              <span className="text-xs text-slate-400">{value}</span>
            )}
          />
          {subcategories.map((sub, i) => (
            <Bar
              key={sub.name}
              dataKey={sub.name}
              stackId="a"
              fill={sub.color}
              radius={i === subcategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
