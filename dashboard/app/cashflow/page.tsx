import { getCashflow, getCashflowBreakdown } from '@/lib/db';
import { formatCurrency, formatMonth, getCurrentMonth } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { CashflowWaterfall, type WaterfallCategory } from '@/components/charts/CashflowWaterfall';
import { MonthNav } from '@/components/spending/MonthNav';

const MONTHS = 12;

/** Top 8 categories by spend; the remainder collapse into a single "Other" bar. */
function prepareWaterfallCategories(
  categories: { parent_category: string; colour: string; total_cents: number }[],
): WaterfallCategory[] {
  const top = categories.slice(0, 8).map((c) => ({
    name: c.parent_category,
    value: c.total_cents,
    color: c.colour || '#9CA3AF',
  }));
  const rest = categories.slice(8);
  if (rest.length > 0) {
    top.push({
      name: 'Other',
      value: rest.reduce((sum, c) => sum + c.total_cents, 0),
      color: '#6B7280',
    });
  }
  return top;
}

export default function CashflowPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? getCurrentMonth();
  const breakdown = getCashflowBreakdown(month);
  const rows = getCashflow(MONTHS);

  const chartData = rows.map((r) => ({
    month: r.month,
    income: r.income_cents,
    expense: r.expense_cents,
    net: r.net_cents,
  }));

  const savingsRate = breakdown.incomeCents > 0
    ? Math.round((breakdown.netCents / breakdown.incomeCents) * 100)
    : null;

  const waterfallCategories = prepareWaterfallCategories(breakdown.categories);
  const hasMonthData = breakdown.incomeCents > 0 || breakdown.expenseCents > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Cash Flow</h1>
        <MonthNav month={month} basePath="/cashflow" />
      </div>

      {hasMonthData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label={`Income — ${formatMonth(month)}`} value={formatCurrency(breakdown.incomeCents)} />
            <KpiCard label="Expenses" value={formatCurrency(breakdown.expenseCents)} />
            <KpiCard label="Net Savings" value={formatCurrency(breakdown.netCents)} />
            <KpiCard label="Savings Rate" value={savingsRate !== null ? `${savingsRate}%` : '—'} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Where the money went — {formatMonth(month)}</CardTitle>
            </CardHeader>
            <div className="px-4 pb-6 pt-2 sm:px-6">
              <CashflowWaterfall
                incomeCents={breakdown.incomeCents}
                categories={waterfallCategories}
                netCents={breakdown.netCents}
              />
            </div>
          </Card>
        </>
      ) : (
        <EmptyState
          title={`No cash flow for ${formatMonth(month)}`}
          message="There are no income or expense transactions in this month. Try another month."
        />
      )}

      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expenses — last {MONTHS} months</CardTitle>
            </CardHeader>
            <div className="px-6 pb-6 pt-2">
              <CashflowChart data={chartData} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-6 py-3 font-medium">Month</th>
                    <th className="px-6 py-3 font-medium text-right">Income</th>
                    <th className="px-6 py-3 font-medium text-right">Expenses</th>
                    <th className="px-6 py-3 font-medium text-right">Net</th>
                    <th className="px-6 py-3 font-medium text-right">Savings Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {[...rows].reverse().map((r) => {
                    const rate = r.income_cents > 0 ? Math.round((r.net_cents / r.income_cents) * 100) : null;
                    return (
                      <tr key={r.month} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-3 text-slate-100 whitespace-nowrap">{formatMonth(r.month)}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-emerald-400">{formatCurrency(r.income_cents)}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-orange-400">{formatCurrency(r.expense_cents)}</td>
                        <td className={`px-6 py-3 text-right tabular-nums font-medium ${r.net_cents >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                          {formatCurrency(r.net_cents)}
                        </td>
                        <td className={`px-6 py-3 text-right tabular-nums ${rate === null ? 'text-slate-500' : rate >= 0 ? 'text-slate-300' : 'text-rose-400'}`}>
                          {rate !== null ? `${rate}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
