import React from 'react';
import {
  getLatestNetWorthSnapshot,
  getNetWorthHistory,
  getLatestLoanSnapshots,
  getLatestAssetBreakdown,
  getAssetAccountDetails,
} from '@/lib/db';
import { formatDollars } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { SpendingDonut } from '@/components/charts/SpendingDonut';
import { NetWorthHistoryChart } from '@/components/charts/NetWorthHistoryChart';

function pct(rate: number | null): string {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(2)}%`;
}

function propertyLabel(accountName: string): string {
  if (accountName.toLowerCase().includes('yarran')) return '8 Yarran St';
  if (accountName.toLowerCase().includes('alice')) return '8/55 Alice St';
  return accountName;
}

export default function BalanceSheetPage() {
  const snap = getLatestNetWorthSnapshot();
  const history = getNetWorthHistory();
  const loans = snap ? getLatestLoanSnapshots(snap.snapshot_date) : [];
  const assetRows = getLatestAssetBreakdown();
  const assetDetails = snap ? getAssetAccountDetails(snap.snapshot_date) : [];

  const detailsByClass = assetDetails.reduce<Record<string, typeof assetDetails>>((acc, row) => {
    (acc[row.asset_class] ??= []).push(row);
    return acc;
  }, {});

  if (!snap) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-slate-400">
        No balance sheet data yet. Run <code className="text-slate-300">scripts/ingest_balance_sheet.py</code> first.
      </div>
    );
  }

  // ── Asset donut ────────────────────────────────────────────────────────────
  const donutData = [
    { name: 'Property',    value: snap.property_value_cents,  color: '#8B5CF6' },
    { name: 'Investments', value: snap.investment_cents,       color: '#10B981' },
    { name: 'Cash',        value: snap.cash_cents,             color: '#3B82F6' },
    { name: 'Other',       value: snap.other_assets_cents,     color: '#F59E0B' },
  ].filter((d) => d.value > 0);

  // ── Liability accounts (credit cards, tax bill) ───────────────────────────
  const otherLiabRows = assetRows.filter((r) => r.account_type === 'liability');

  // ── Debt summary: weighted average rate ──────────────────────────────────
  let ratedBalance = 0;
  let ratedWeightedRate = 0;
  let totalMortgageCents = 0;
  let totalAnnualInterest = 0;
  for (const l of loans) {
    totalMortgageCents += l.outstanding_cents;
    if (l.interest_rate) {
      ratedBalance += l.outstanding_cents;
      ratedWeightedRate += l.outstanding_cents * l.interest_rate;
      totalAnnualInterest += l.outstanding_cents * l.interest_rate;
    }
  }
  const weightedAvgRate = ratedBalance > 0 ? ratedWeightedRate / ratedBalance : null;

  // ── Net worth history chart data ──────────────────────────────────────────
  const chartData = history.map((h) => ({
    date: h.snapshot_date,
    net_worth: h.net_worth_cents,
    total_assets: h.total_assets_cents,
    mortgage: h.mortgage_cents,
  }));

  const asOf = snap.snapshot_date;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Balance Sheet</h1>
        <span className="text-sm text-slate-500">
          As at {asOf.split('-').reverse().join('/')}
        </span>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Net Worth"
          value={formatDollars(snap.net_worth_cents)}
          subtitle={`Assets − Liabilities`}
        />
        <KpiCard
          label="Total Assets"
          value={formatDollars(snap.total_assets_cents)}
          subtitle={`Property ${formatDollars(snap.property_value_cents)}`}
        />
        <KpiCard
          label="Total Liabilities"
          value={formatDollars(snap.total_liabilities_cents)}
          subtitle={`Mortgage ${formatDollars(snap.mortgage_cents)}`}
        />
      </div>

      {/* ── Asset + Liability columns ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <div className="px-6 pb-2">
            {donutData.length > 0 && <SpendingDonut data={donutData} />}
          </div>
          <div className="px-6 pb-6">
            <table className="w-full text-sm">
              <tbody>
                {[
                  { label: 'Property',    cents: snap.property_value_cents,  color: '#8B5CF6' },
                  { label: 'Investments', cents: snap.investment_cents,       color: '#10B981' },
                  { label: 'Cash',        cents: snap.cash_cents,             color: '#3B82F6' },
                  { label: 'Other',       cents: snap.other_assets_cents,     color: '#F59E0B' },
                ].map(({ label, cents, color }) => (
                  <React.Fragment key={label}>
                    <tr className="border-t border-slate-800">
                      <td className="pt-3 pb-1.5 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-slate-300 font-medium">{label}</span>
                      </td>
                      <td className="pt-3 pb-1.5 text-right tabular-nums text-slate-100 font-medium">
                        {formatDollars(cents)}
                      </td>
                      <td className="pt-3 pb-1.5 text-right tabular-nums text-slate-500 pl-4 w-14">
                        {snap.total_assets_cents > 0
                          ? `${((cents / snap.total_assets_cents) * 100).toFixed(0)}%`
                          : '—'}
                      </td>
                    </tr>
                    {(detailsByClass[label] ?? []).map((d) => (
                      <tr key={d.account_name}>
                        <td className="py-1 pl-5 text-slate-500">{d.account_name}</td>
                        <td className="py-1 text-right tabular-nums text-slate-500">
                          {formatDollars(d.balance_cents)}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td className="pt-3 text-slate-400 font-medium">Total</td>
                  <td className="pt-3 text-right tabular-nums text-slate-100 font-semibold">
                    {formatDollars(snap.total_assets_cents)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader>
            <CardTitle>Liabilities</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-6">

            {/* Mortgages */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Mortgages
              </p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-800">
                  {loans.map((l) => (
                    <tr key={l.account_name}>
                      <td className="py-2.5 text-slate-300">{l.account_name}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-100">
                        {formatDollars(l.outstanding_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700">
                    <td className="pt-3 text-slate-400 font-medium">Subtotal</td>
                    <td className="pt-3 text-right tabular-nums text-slate-100 font-semibold">
                      {formatDollars(totalMortgageCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Other liabilities */}
            {otherLiabRows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Other
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-800">
                    {otherLiabRows.map((r) => (
                      <tr key={r.account_name}>
                        <td className="py-2.5 text-slate-300">{r.account_name}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-100">
                          {formatDollars(r.balance_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700">
                      <td className="pt-3 text-slate-400 font-medium">Subtotal</td>
                      <td className="pt-3 text-right tabular-nums text-slate-100 font-semibold">
                        {formatDollars(snap.other_liabilities_cents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="border-t border-slate-700 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Total Liabilities</span>
                <span className="tabular-nums text-slate-100 font-semibold">
                  {formatDollars(snap.total_liabilities_cents)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Debt Summary ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Debt Summary</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Property
                </th>
                <th className="text-left py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Facility
                </th>
                <th className="text-left py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Balance
                </th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Rate
                </th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Annual Interest
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loans.map((l, i) => {
                const annual = l.interest_rate ? Math.round(l.outstanding_cents * l.interest_rate) : null;
                return (
                  <tr key={i}>
                    <td className="py-3 text-slate-300">{propertyLabel(l.account_name)}</td>
                    <td className="py-3 text-slate-400">
                      {l.account_name.includes('fixed') ? 'A' : 'B'}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        l.facility_type === 'fixed'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {l.facility_type ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-100">
                      {formatDollars(l.outstanding_cents)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-300">
                      {pct(l.interest_rate)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-300">
                      {annual !== null ? formatDollars(annual) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700">
                <td className="pt-3 font-semibold text-slate-100" colSpan={3}>Total</td>
                <td className="pt-3 text-right tabular-nums font-semibold text-slate-100">
                  {formatDollars(totalMortgageCents)}
                </td>
                <td className="pt-3 text-right tabular-nums font-medium text-slate-300">
                  {pct(weightedAvgRate)}
                </td>
                <td className="pt-3 text-right tabular-nums font-medium text-slate-300">
                  {totalAnnualInterest > 0 ? `${formatDollars(Math.round(totalAnnualInterest))} p.a.` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Net Worth History ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth History</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          <NetWorthHistoryChart data={chartData} />
        </div>
      </Card>
    </div>
  );
}
