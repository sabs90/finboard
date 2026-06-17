import { getNetWorthHistory, getLatestNetWorthSnapshot } from '@/lib/db';
import { formatDollars } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { NetWorthStackedChart } from '@/components/charts/NetWorthStackedChart';
import type { NetWorthStackedPoint } from '@/components/charts/NetWorthStackedChart';

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

      {/* ── Stacked area chart ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Wealth Composition — Quarterly</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          <NetWorthStackedChart data={chartData} />
        </div>
      </Card>

      {/* ── Snapshot breakdown table ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
          <div className="px-6 pb-6">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {[
                  { label: 'Property',    cents: snap.property_value_cents,  color: '#8B5CF6' },
                  { label: 'Investments', cents: snap.investment_cents,       color: '#10B981' },
                  { label: 'Cash',        cents: snap.cash_cents,             color: '#3B82F6' },
                  { label: 'Other',       cents: snap.other_assets_cents,     color: '#F59E0B' },
                ].map(({ label, cents, color }) => (
                  <tr key={label}>
                    <td className="py-2.5 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-slate-300">{label}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-100">
                      {formatDollars(cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td className="pt-3 font-semibold text-slate-300">Total Assets</td>
                  <td className="pt-3 text-right tabular-nums font-semibold text-slate-100">
                    {formatDollars(snap.total_assets_cents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Liabilities</CardTitle></CardHeader>
          <div className="px-6 pb-6">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {[
                  { label: 'Mortgage',          cents: snap.mortgage_cents,           color: '#EF4444' },
                  { label: 'Other Liabilities',  cents: snap.other_liabilities_cents,  color: '#F97316' },
                ].map(({ label, cents, color }) => (
                  <tr key={label}>
                    <td className="py-2.5 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-slate-300">{label}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-100">
                      {formatDollars(cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td className="pt-3 font-semibold text-slate-300">Total Liabilities</td>
                  <td className="pt-3 text-right tabular-nums font-semibold text-rose-400">
                    {formatDollars(snap.total_liabilities_cents)}
                  </td>
                </tr>
                <tr className="border-t border-slate-600">
                  <td className="pt-3 font-bold text-slate-100">Net Worth</td>
                  <td className="pt-3 text-right tabular-nums font-bold text-emerald-400">
                    {formatDollars(snap.net_worth_cents)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {(qoqChange !== null || yoyChange !== null) && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                {qoqChange !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">vs last quarter</span>
                    <span className={`font-medium tabular-nums ${qoqChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {qoqChange >= 0 ? '+' : ''}{formatDollars(qoqChange)}
                    </span>
                  </div>
                )}
                {yoyChange !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">vs 1 year ago</span>
                    <span className={`font-medium tabular-nums ${yoyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {yoyChange >= 0 ? '+' : ''}{formatDollars(yoyChange)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
