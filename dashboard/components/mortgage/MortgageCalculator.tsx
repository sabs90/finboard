'use client';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { amortise, addMonthsIso, formatMonthsAsYears, MAX_MONTHS } from '@/lib/mortgage';
import { formatDollars, formatDate } from '@/lib/formatters';
import { SEMANTIC } from '@/lib/chartColors';

interface Props {
  balanceCents: number;
  offsetCents: number;
  annualRate: number;
  monthlyRepaymentCents: number;
  startDate: string; // ISO — the as-at date projections start from
}

const EXTRA_CHIPS = [0, 250, 500, 1000, 2000];

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

const inputClass =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:outline-none focus:border-slate-500 w-32 tabular-nums';

function parseDollars(s: string): number {
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function MortgageCalculator({ balanceCents, offsetCents, annualRate, monthlyRepaymentCents, startDate }: Props) {
  const [extraInput, setExtraInput] = useState('500');
  const [lumpInput, setLumpInput] = useState('');

  const extraCents = Math.round(parseDollars(extraInput) * 100);
  const lumpCents = Math.round(parseDollars(lumpInput) * 100);

  const { baseline, scenario, chartData } = useMemo(() => {
    const base = { balanceCents, offsetCents, annualRate, monthlyRepaymentCents };
    const baseline = amortise(base);
    const scenario = amortise({ ...base, extraMonthlyCents: extraCents, lumpSumCents: lumpCents });

    // One row per quarter, out to the baseline horizon (or 50y cap).
    const horizon = Math.min(baseline.months, MAX_MONTHS);
    const rows: { date: string; baseline: number | null; scenario: number | null }[] = [];
    for (let m = 0; m <= horizon; m += 3) {
      rows.push({
        date: addMonthsIso(startDate, m),
        baseline: baseline.schedule[m]?.balanceCents ?? 0,
        scenario: scenario.schedule[m]?.balanceCents ?? 0,
      });
    }
    return { baseline, scenario, chartData: rows };
  }, [balanceCents, offsetCents, annualRate, monthlyRepaymentCents, extraCents, lumpCents, startDate]);

  const hasChange = extraCents > 0 || lumpCents > 0;
  const monthsSaved = baseline.paysOff && scenario.paysOff ? baseline.months - scenario.months : null;
  const interestSaved = baseline.totalInterestCents - scenario.totalInterestCents;

  const ChartTip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload?.length || !label) return null;
    const names: Record<string, string> = { baseline: 'Current repayments', scenario: 'With extra' };
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg min-w-[180px]">
        <p className="text-xs text-slate-400 mb-1.5">{formatDate(label)}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between gap-4 text-sm">
            <span className="text-slate-400">{names[p.dataKey] ?? p.dataKey}</span>
            <span className="font-semibold tabular-nums" style={{ color: p.color }}>{fmtK(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* ── Inputs ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Extra per month</p>
          <div className="flex flex-wrap items-center gap-2">
            {EXTRA_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setExtraInput(String(d))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  parseDollars(extraInput) === d
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {d === 0 ? 'None' : `$${d.toLocaleString()}`}
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              value={extraInput}
              onChange={(e) => setExtraInput(e.target.value)}
              placeholder="Custom"
              aria-label="Extra repayment per month, dollars"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">One-off lump sum</p>
          <input
            type="text"
            inputMode="numeric"
            value={lumpInput}
            onChange={(e) => setLumpInput(e.target.value)}
            placeholder="e.g. 20000"
            aria-label="One-off lump sum, dollars"
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Paid off</p>
          <p className="mt-1 text-lg font-bold text-slate-100 tabular-nums">
            {scenario.paysOff ? formatDate(addMonthsIso(startDate, scenario.months)) : 'Never'}
          </p>
          <p className="text-xs text-slate-500">
            {scenario.paysOff ? `in ${formatMonthsAsYears(scenario.months)}` : 'repayments ≤ interest'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Time saved</p>
          <p className="mt-1 text-lg font-bold text-emerald-400 tabular-nums">
            {hasChange && monthsSaved !== null ? formatMonthsAsYears(monthsSaved) : hasChange && scenario.paysOff ? '50+ yr' : '—'}
          </p>
          <p className="text-xs text-slate-500">vs current repayments</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Interest saved</p>
          <p className="mt-1 text-lg font-bold text-emerald-400 tabular-nums">
            {hasChange ? formatDollars(Math.max(0, interestSaved)) : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {baseline.paysOff ? 'over the life of the loan' : 'over the next 50 years'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total interest</p>
          <p className="mt-1 text-lg font-bold text-slate-100 tabular-nums">{formatDollars(scenario.totalInterestCents)}</p>
          <p className="text-xs text-slate-500">
            {scenario.paysOff ? 'until paid off' : 'next 50 years'}
          </p>
        </div>
      </div>

      {!baseline.paysOff && (
        <p className="mt-4 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-2.5">
          At the current repayment the loan never pays down — repayments roughly cover interest only.
          The scenario figures show what changes with extra repayments.
        </p>
      )}

      {/* ── Projection chart ────────────────────────────────────────────── */}
      <div className="mt-6 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(0, 4)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="baseline" stroke="#64748B" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="scenario" stroke={SEMANTIC.income} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 justify-center mt-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 border-t border-dashed border-slate-500" />
          Current repayments
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: SEMANTIC.income }} />
          With extra repayments
        </span>
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Assumes the interest rate, offset balance and repayment stay constant; interest calculated
        monthly on the balance net of offset. Actual lender daily-interest figures will differ slightly.
      </p>
    </div>
  );
}
