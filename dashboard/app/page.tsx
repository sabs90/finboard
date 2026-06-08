import { getOverviewKpis, getCategoryBreakdown, getMonthlyTotals, getRecentTransactions } from '@/lib/db';
import { getCurrentMonth, formatCurrency, formatDate, formatMonth } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { SpendingDonut } from '@/components/charts/SpendingDonut';
import { MonthlyBarChart } from '@/components/charts/MonthlyBarChart';
import { getCategoryColor } from '@/lib/chartColors';

function prepareDonutData(rows: { parent_category: string; colour: string; total_cents: number }[]) {
  const top = rows.slice(0, 8);
  const rest = rows.slice(8);
  const items = top.map((r) => ({
    name: r.parent_category,
    value: r.total_cents,
    color: r.colour || getCategoryColor(r.parent_category),
  }));
  if (rest.length > 0) {
    items.push({
      name: 'Other',
      value: rest.reduce((sum, r) => sum + r.total_cents, 0),
      color: '#6B7280',
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

  const donutData = prepareDonutData(categoryBreakdown);
  const barData = monthlyTotals.map((r) => ({ month: r.month, total: r.total_cents }));

  const savings = kpis.totalIncomeCents + kpis.totalSpendCents;
  const savingsRate = kpis.totalIncomeCents > 0
    ? Math.round((savings / kpis.totalIncomeCents) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <span className="text-sm text-slate-400">{formatMonth(month)}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Spent this month"
          value={formatCurrency(Math.abs(kpis.totalSpendCents))}
        />
        <KpiCard
          label="Income"
          value={formatCurrency(kpis.totalIncomeCents)}
        />
        <KpiCard
          label="Savings rate"
          value={`${savingsRate}%`}
          subtitle={formatCurrency(savings)}
        />
        <KpiCard
          label="Top category"
          value={kpis.topCategory}
          subtitle={formatCurrency(kpis.topCategoryCents)}
        />
      </div>

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
                    <td className={`px-6 py-3 text-right font-medium whitespace-nowrap tabular-nums ${
                      txn.amount_cents >= 0 ? 'text-emerald-400' : 'text-slate-100'
                    }`}>
                      {formatCurrency(txn.amount_cents)}
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
