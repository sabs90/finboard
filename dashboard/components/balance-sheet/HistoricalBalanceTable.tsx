'use client';

import type { HistoricalBalancePoint, NetWorthSnapshot } from '@/lib/db';

// ── Compact number format ─────────────────────────────────────────────────────
// All values are in cents: $1 = 100, $1k = 100_000, $1M = 100_000_000
function fmt(cents: number | undefined): string {
  if (cents === undefined || cents === 0) return '—';
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}$${(abs / 100_000_000).toFixed(1)}M`;
  if (abs >= 100_000)     return `${sign}$${(abs / 100_000).toFixed(0)}k`;
  return `${sign}$${(abs / 100).toFixed(0)}`;
}

const CATEGORY_ORDER = ['Cash', 'Investments', 'Property', 'Other', 'Mortgages', 'Other Liabilities'];

const CATEGORY_LABELS: Record<string, string> = {
  Cash: 'Cash',
  Investments: 'Investments',
  Property: 'Property',
  Other: 'Other Assets',
  Mortgages: 'Mortgages',
  'Other Liabilities': 'Other Liabilities',
};

interface Props {
  points: HistoricalBalancePoint[];
  snapshots: NetWorthSnapshot[];
}

export function HistoricalBalanceTable({ points, snapshots }: Props) {
  // All quarter dates, newest first
  const dates = [...new Set(points.map((p) => p.balance_date))].sort().reverse();

  // Pivot: category → accountName → date → cents
  const byCategory: Record<string, Record<string, Record<string, number>>> = {};
  for (const p of points) {
    byCategory[p.category] ??= {};
    byCategory[p.category][p.account_name] ??= {};
    byCategory[p.category][p.account_name][p.balance_date] = p.balance_cents;
  }

  // Snapshot lookup by date
  const snapByDate: Record<string, NetWorthSnapshot> = {};
  for (const s of snapshots) snapByDate[s.snapshot_date] = s;

  // Category subtotals from snapshots (source of truth)
  const subtotalFn: Record<string, (s: NetWorthSnapshot) => number> = {
    Cash:               (s) => s.cash_cents,
    Investments:        (s) => s.investment_cents,
    Property:           (s) => s.property_value_cents,
    Other:              (s) => s.other_assets_cents,
    Mortgages:          (s) => s.mortgage_cents,
    'Other Liabilities': (s) => s.other_liabilities_cents,
  };

  const thBase = 'px-3 py-2 text-right text-xs font-medium text-slate-400 whitespace-nowrap tabular-nums';
  const tdBase = 'px-3 py-1.5 text-right text-xs tabular-nums whitespace-nowrap';

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse" style={{ minWidth: '100%' }}>
        <thead>
          <tr className="border-b border-slate-700">
            {/* Sticky account name header */}
            <th
              className="sticky left-0 z-10 bg-slate-900 px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap min-w-[200px]"
            >
              Account
            </th>
            {dates.map((d) => (
              <th key={d} className={thBase}>
                {formatQuarter(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((cat) => {
            const accounts = byCategory[cat];
            if (!accounts) return null;
            const accountNames = Object.keys(accounts).sort((a, b) => {
              const latestA = Math.max(...Object.values(accounts[a]));
              const latestB = Math.max(...Object.values(accounts[b]));
              return latestB - latestA;
            });

            return (
              <>
                {/* Category header row */}
                <tr key={`${cat}-header`} className="border-t border-slate-700 bg-slate-800/40">
                  <td
                    className="sticky left-0 z-10 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide"
                  >
                    {CATEGORY_LABELS[cat]}
                  </td>
                  {dates.map((d) => {
                    const snap = snapByDate[d];
                    const total = snap ? subtotalFn[cat]?.(snap) : undefined;
                    return (
                      <td key={d} className={`${tdBase} font-semibold text-slate-200`}>
                        {fmt(total)}
                      </td>
                    );
                  })}
                </tr>

                {/* Individual account rows */}
                {accountNames.map((name) => (
                  <tr key={`${cat}-${name}`} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td
                      className="sticky left-0 z-10 bg-slate-900 pl-8 pr-4 py-1.5 text-xs text-slate-400 whitespace-nowrap"
                      style={{ backgroundClip: 'padding-box' }}
                    >
                      {name}
                    </td>
                    {dates.map((d) => {
                      const val = accounts[name][d];
                      return (
                        <td key={d} className={`${tdBase} text-slate-400`}>
                          {val !== undefined && val > 0 ? fmt(val) : <span className="text-slate-700">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })}

          {/* Summary rows */}
          <tr className="border-t-2 border-slate-600 bg-slate-800/60">
            <td className="sticky left-0 z-10 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Total Assets
            </td>
            {dates.map((d) => (
              <td key={d} className={`${tdBase} font-semibold text-slate-200`}>
                {fmt(snapByDate[d]?.total_assets_cents)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-700 bg-slate-800/60">
            <td className="sticky left-0 z-10 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Total Liabilities
            </td>
            {dates.map((d) => (
              <td key={d} className={`${tdBase} font-semibold text-rose-400`}>
                {fmt(snapByDate[d]?.total_liabilities_cents)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-600 bg-slate-800/80">
            <td className="sticky left-0 z-10 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-100 uppercase tracking-wide">
              Net Worth
            </td>
            {dates.map((d) => {
              const nw = snapByDate[d]?.net_worth_cents;
              return (
                <td key={d} className={`px-3 py-2.5 text-right text-sm font-bold tabular-nums whitespace-nowrap ${
                  nw !== undefined && nw >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {fmt(nw)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function formatQuarter(date: string): string {
  const [year, month] = date.split('-');
  const q = Math.ceil(parseInt(month) / 3);
  return `Q${q} ${year.slice(2)}`;
}
