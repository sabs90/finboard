'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';
import type { ForecastPoint, MilestoneRow } from '@/lib/db';
import { SEMANTIC } from '@/lib/chartColors';

interface Props {
  points: ForecastPoint[];
  targetCents: number | null;
  targetLabel?: string;
  projectedDate: string | null;
  milestones: MilestoneRow[];
}

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

function ForecastTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const labelMap: Record<string, string> = {
    net_worth_cents: 'Net Worth',
    forecast_cents: 'Forecast',
  };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
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

/** Map a milestone to the nearest charted point so its marker sits on the line. */
function nearestPoint(points: ForecastPoint[], date: string): ForecastPoint | null {
  let best: ForecastPoint | null = null;
  let bestGap = Infinity;
  for (const p of points) {
    const gap = Math.abs(Date.parse(p.date) - Date.parse(date));
    if (gap < bestGap) {
      bestGap = gap;
      best = p;
    }
  }
  return best;
}

export function NetWorthForecastChart({ points, targetCents, targetLabel, projectedDate, milestones }: Props) {
  const markers = milestones
    .map((m) => {
      const p = nearestPoint(points, m.milestone_date);
      if (!p) return null;
      const y = p.net_worth_cents ?? p.forecast_cents;
      if (y === null) return null;
      return { x: p.date, y, label: m.label };
    })
    .filter((m): m is { x: string; y: number; label: string } => m !== null);

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtTick}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval={Math.max(0, Math.floor(points.length / 10) - 1)}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={targetCents ? [0, (dataMax: number) => Math.max(dataMax, targetCents * 1.05)] : undefined}
          />
          <Tooltip content={<ForecastTooltip />} />
          {targetCents !== null && (
            <ReferenceLine
              y={targetCents}
              stroke={SEMANTIC.warning}
              strokeDasharray="6 3"
              label={{
                value: `${targetLabel ?? 'Goal'} ${fmtK(targetCents)}`,
                position: 'insideTopRight',
                fill: SEMANTIC.warning,
                fontSize: 11,
              }}
            />
          )}
          {projectedDate !== null && points.some((p) => p.date === projectedDate) && (
            <ReferenceLine
              x={projectedDate}
              stroke={SEMANTIC.warning}
              strokeDasharray="2 3"
              strokeOpacity={0.6}
              label={{ value: fmtTick(projectedDate), position: 'top', fill: SEMANTIC.warning, fontSize: 11 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="net_worth_cents"
            stroke={SEMANTIC.income}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast_cents"
            stroke={SEMANTIC.income}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeOpacity={0.6}
            dot={false}
            connectNulls={false}
          />
          {markers.map((m) => (
            <ReferenceDot
              key={`${m.x}-${m.label}`}
              x={m.x}
              y={m.y}
              r={4}
              fill="#E2E8F0"
              stroke="#0F172A"
              strokeWidth={1.5}
              label={{ value: m.label, position: 'top', fill: '#CBD5E1', fontSize: 10 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-6 justify-center mt-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: SEMANTIC.income }} />
          Actual
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 border-t border-dashed" style={{ borderColor: SEMANTIC.income }} />
          Forecast (trailing-year trend)
        </span>
        {targetCents !== null && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-3 border-t border-dashed" style={{ borderColor: SEMANTIC.warning }} />
            Goal
          </span>
        )}
        {markers.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-200" />
            Milestone
          </span>
        )}
      </div>
    </div>
  );
}
