import { getOverviewKpis, getCategoryBreakdown, getMonthlyTotals, getRecentTransactions, getLatestNetWorthSnapshot, getSpendIncomeUpToDay, getUpcomingBillsCount, getInsights, getCashflow } from '@/lib/db';
import { getCurrentMonth, formatCurrency, formatDollars, formatDate, formatMonth, prevMonth } from '@/lib/formatters';
import Link from 'next/link';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Amount } from '@/components/ui/Amount';
import { SpendingDonut } from '@/components/charts/SpendingDonut';
import { MonthlyBarChart } from '@/components/charts/MonthlyBarChart';
import { InsightsPanel } from '@/components/overview/InsightsPanel';
import { getCategoryColor, SEMANTIC } from '@/lib/chartColors';

function prepareDonutData(rows: { parent_category: string; category_id: number | null; colour: string; total_cents: number }[]) {
  const top = rows.slice(0, 8);
  const rest = rows.slice(8);
  const items = top.map((r) => ({
    name: r.parent_category,
    value: r.total_cents,
    color: r.colour || getCategoryColor(r.parent_category),
    categoryId: r.category_id,
  }));
  if (rest.length > 0) {
    items.push({
      name: 'Other',
      value: rest.reduce((sum, r) => sum + r.total_cents, 0),
      color: '#6B7280',
      categoryId: null,
    });
  }
  return items;
}

export default function OverviewPage() {
  const month = getCurrentMonth();
  const kpis = getOverviewKpis(month);
  const categoryBreakdown = getCategoryBreakdown(month);
  const monthlyTotals = getMonthlyTotals(6);
  const recentTransactions = getRecentTransactions(10);
  const netWorth = getLatestNetWorthSnapshot();
  const upcomingBills = getUpcomingBillsCount(14);
  const insights = getInsights(month);

  const donutData = prepareDonutData(categoryBreakdown);
  const barData = monthlyTotals.map((r) => ({ month: r.month, total: r.total_cents }));

  const savings = kpis.totalIncomeCents + kpis.totalSpendCents;
  const savingsRate = kpis.totalIncomeCents > 0
    ? Math.round((savings / kpis.totalIncomeCents) * 100)
    : 0;

  // ── Month-to-date comparison vs the same point last month ──────────────────
  const currentDay = new Date().getDate();
  const lastMTD = getSpendIncomeUpToDay(prevMonth(month), currentDay);

  const thisSpend = Math.abs(kpis.totalSpendCents);
  const lastSpend = Math.abs(lastMTD.spendCents);
  const spendPct = lastSpend > 0 ? Math.round(((thisSpend - lastSpend) / lastSpend) * 100) : null;

  const thisIncome = kpis.totalIncomeCents;
  const lastIncome = lastMTD.incomeCents;
  const incomePct = lastIncome > 0 ? Math.round(((thisIncome - lastIncome) / lastIncome) * 100) : null;

  const lastSavings = lastMTD.incomeCents + lastMTD.spendCents;
  const lastSavingsRate = lastIncome > 0 ? Math.round((lastSavings / lastIncome) * 100) : null;
  const savingsRateDelta = lastSavingsRate !== null ? savingsRate - lastSavingsRate : null;

  // ── KPI sparklines — last 6 *full* months (the partial current month would
  //    read as a false dip) ────────────────────────────────────────────────────
  const sparkMonths = getCashflow(7).filter((r) => r.month < month).slice(-6);
  const spendSpark = sparkMonths.map((r) => r.expense_cents);
  const incomeSpark = sparkMonths.map((r) => r.income_cents);
  const savingsRateSpark = sparkMonths.map((r) =>
    r.income_cents > 0 ? (r.net_cents / r.income_cents) * 100 : 0,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <span className="text-sm text-slate-400">{formatMonth(month)}</span>
      </div>

      {/* ── Net Worth hero ──────────────────────────────────────────── */}
      {netWorth && (
        <Link href="/networth" className="block">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-5 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Net Worth</p>
                <p className="mt-1 text-4xl font-bold text-slate-100 tabular-nums">
                  {formatDollars(netWorth.net_worth_cents)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  As at {netWorth.snapshot_date.split('-').reverse().join('/')}
                </p>
              </div>
              <div className="text-right space-y-1 mt-1">
                {[
                  { label: 'Property equity', cents: netWorth.property_equity_cents },
                  { label: 'Investments',     cents: netWorth.investment_cents },
                  { label: 'Cash',            cents: netWorth.cash_cents },
                ].map(({ label, cents }) => (
                  <div key={label} className="flex items-center gap-3 justify-end">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm tabular-nums text-slate-300 w-24 text-right">
                      {formatDollars(cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Spent this month"
          value={formatCurrency(thisSpend)}
          subtitle="Month to date"
          spark={{ values: spendSpark, color: SEMANTIC.expense }}
          trend={spendPct !== null ? {
            value: `${Math.abs(spendPct)}% vs last month`,
            positive: thisSpend <= lastSpend,
            direction: thisSpend >= lastSpend ? 'up' : 'down',
          } : undefined}
        />
        <KpiCard
          label="Income"
          value={formatCurrency(thisIncome)}
          subtitle="Month to date"
          spark={{ values: incomeSpark, color: SEMANTIC.income }}
          trend={incomePct !== null ? {
            value: `${Math.abs(incomePct)}% vs last month`,
            positive: thisIncome >= lastIncome,
            direction: thisIncome >= lastIncome ? 'up' : 'down',
          } : undefined}
        />
        <KpiCard
          label="Savings rate"
          value={`${savingsRate}%`}
          subtitle={formatCurrency(savings)}
          spark={{ values: savingsRateSpark, color: SEMANTIC.net }}
          trend={savingsRateDelta !== null ? {
            value: `${savingsRateDelta >= 0 ? '+' : ''}${savingsRateDelta}pp vs last month`,
            positive: savingsRateDelta >= 0,
            direction: savingsRateDelta >= 0 ? 'up' : 'down',
          } : undefined}
        />
        <KpiCard
          label="Top category"
          value={kpis.topCategory}
          subtitle={formatCurrency(kpis.topCategoryCents)}
        />
      </div>

      <InsightsPanel data={insights} />

      {upcomingBills > 0 && (
        <Link
          href="/recurring"
          className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 hover:border-slate-700 transition-colors"
        >
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-slate-100">{upcomingBills}</span>{' '}
            recurring {upcomingBills === 1 ? 'bill' : 'bills'} expected in the next 14 days
          </span>
          <span className="text-sm text-slate-400">View recurring →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <div className="p-6">
            {donutData.length > 0 ? (
              <SpendingDonut data={donutData} />
            ) : (
              <p className="text-sm text-slate-500 text-center py-12">No spending data this month.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending</CardTitle>
          </CardHeader>
          <div className="p-6">
            {barData.length > 0 ? (
              <MonthlyBarChart data={barData} />
            ) : (
              <p className="text-sm text-slate-500 text-center py-12">No historical data yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        {recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recentTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3 text-slate-400 whitespace-nowrap">
                      {formatDate(txn.transaction_date)}
                    </td>
                    <td className="px-6 py-3 text-slate-100">
                      {txn.merchant || txn.description}
                    </td>
                    <td className="px-6 py-3">
                      {txn.parent_category ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: txn.colour || '#9CA3AF' }}
                          />
                          {txn.parent_category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Uncategorised</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <Amount cents={txn.amount_cents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">
            No transactions yet.
          </div>
        )}
      </Card>
    </div>
  );
}
