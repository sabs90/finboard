import { getNetWorthHistory, getLatestNetWorthSnapshot } from '@/lib/db';
import { formatDollars } from '@/lib/formatters';
import Link from 'next/link';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { NetWorthStackedChart } from '@/components/charts/NetWorthStackedChart';
import type { NetWorthStackedPoint } from '@/components/charts/NetWorthStackedChart';
import { NetWorthHistoryChart } from '@/components/charts/NetWorthHistoryChart';

export default function NetWorthPage() {
  const snap = getLatestNetWorthSnapshot();
  const history = getNetWorthHistory();

  if (!snap) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-slate-400">
        No net worth data yet. Run <code className="text-slate-300">scripts/ingest_balance_sheet.py</code> first.
      </div>
    );
  }

  const chartData: NetWorthStackedPoint[] = history.map((h) => ({
    date: h.snapshot_date,
    property_equity: Math.max(0, h.property_equity_cents),
    investment: Math.max(0, h.investment_cents),
    cash: Math.max(0, h.cash_cents),
    other_assets: Math.max(0, h.other_assets_cents),
    net_worth: h.net_worth_cents,
  }));

  const lineData = history.map((h) => ({
    date: h.snapshot_date,
    net_worth: h.net_worth_cents,
    total_assets: h.total_assets_cents,
    mortgage: h.mortgage_cents,
  }));

  // Quarter-on-quarter change in net worth
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const qoqChange = prev ? snap.net_worth_cents - prev.net_worth_cents : null;

  // Year-on-year (4 quarters back)
  const yearAgo = history.length >= 5 ? history[history.length - 5] : null;
  const yoyChange = yearAgo ? snap.net_worth_cents - yearAgo.net_worth_cents : null;

  const asOf = snap.snapshot_date.split('-').reverse().join('/');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Net Worth</h1>
        <span className="text-sm text-slate-500">As at {asOf}</span>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Net Worth"
          value={formatDollars(snap.net_worth_cents)}
          trend={qoqChange !== null ? {
            value: `${formatDollars(Math.abs(qoqChange))} vs last quarter`,
            positive: qoqChange >= 0,
          } : undefined}
        />
        <KpiCard
          label="Property Equity"
          value={formatDollars(snap.property_equity_cents)}
          subtitle={`Value ${formatDollars(snap.property_value_cents)}`}
        />
        <KpiCard
          label="Investments"
          value={formatDollars(snap.investment_cents)}
        />
        <KpiCard
          label="Cash"
          value={formatDollars(snap.cash_cents)}
          subtitle={`Other ${formatDollars(snap.other_assets_cents)}`}
        />
      </div>

      {/* ── Change summary ────────────────────────────────────────────── */}
      {(qoqChange !== null || yoyChange !== null) && (
        <div className="grid grid-cols-2 gap-4">
          {qoqChange !== null && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">vs last quarter</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${qoqChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {qoqChange >= 0 ? '+' : ''}{formatDollars(qoqChange)}
              </p>
            </div>
          )}
          {yoyChange !== null && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">vs 1 year ago</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${yoyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {yoyChange >= 0 ? '+' : ''}{formatDollars(yoyChange)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Wealth composition (stacked area) ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Wealth Composition — Quarterly</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          <NetWorthStackedChart data={chartData} />
        </div>
      </Card>

      {/* ── Net worth vs assets vs debt (line) ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth History</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          <NetWorthHistoryChart data={lineData} />
        </div>
      </Card>

      {/* ── Link to detailed positions ────────────────────────────────── */}
      <Link
        href="/balance-sheet"
        className="block bg-slate-900 rounded-2xl border border-slate-800 px-6 py-4 hover:border-slate-700 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">View the Balance Sheet →</p>
            <p className="text-xs text-slate-500 mt-0.5">Detailed account positions, debt facilities, and quarterly history</p>
          </div>
          <span className="text-slate-500 text-lg">→</span>
        </div>
      </Link>
    </div>
  );
}
