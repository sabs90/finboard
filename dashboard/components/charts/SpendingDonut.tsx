'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/formatters';

interface DonutDataItem {
  name: string;
  value: number;
  color: string;
  categoryId?: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DonutDataItem }>;
}

function DonutTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-sm text-slate-100">{item.name}</span>
      </div>
      <p className="text-sm font-semibold text-slate-100 mt-0.5 pl-[18px]">
        {formatCurrency(item.value)}
      </p>
    </div>
  );
}

export function SpendingDonut({ data }: { data: DonutDataItem[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const router = useRouter();

  function drill(item: DonutDataItem) {
    if (item.categoryId != null) {
      router.push(`/deep-dive?parent=${item.categoryId}`);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              dataKey="value"
              stroke="none"
              paddingAngle={2}
              onClick={(_, index) => drill(data[index])}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  className={entry.categoryId != null ? 'cursor-pointer focus:outline-none' : ''}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-400 text-xs"
            >
              Total
            </text>
            <text
              x="50%"
              y="56%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-100 text-lg font-bold"
            >
              {formatCurrency(total)}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2 w-full max-w-sm">
        {data.map((item) => {
          const clickable = item.categoryId != null;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => drill(item)}
              disabled={!clickable}
              className={`flex items-center gap-2 text-sm text-left ${
                clickable ? 'hover:text-slate-100 cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-400 truncate hover:text-inherit">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
