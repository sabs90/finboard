import { getCashflow } from '@/lib/db';
import { formatCurrency, formatMonth } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { CashflowChart } from '@/components/charts/CashflowChart';

const MONTHS = 12;

export default function CashflowPage() {
  const rows = getCashflow(MONTHS);

  const chartData = rows.map((r) => ({
    month: r.month,
    income: r.income_cents,
    expense: r.expense_cents,
    net: r.net_cents,
  }));

  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;

  const savingsRate = latest && latest.income_cents > 0
    ? Math.round((latest.net_cents / latest.income_cents) * 100)
    : null;

  const netChange = latest && prev ? latest.net_cents - prev.net_cents : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Cash Flow</h1>
        <span className="text-sm text-slate-400">Last {MONTHS} months</span>
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label={`Income — ${formatMonth(latest.month)}`} value={formatCurrency(latest.income_cents)} />
            <KpiCard label="Expenses" value={formatCurrency(latest.expense_cents)} />
            <KpiCard
              label="Net Savings"
              value={formatCurrency(latest.net_cents)}
              trend={netChange !== null ? {
                value: `${formatCurrency(Math.abs(netChange))} vs last month`,
                positive: netChange >= 0,
              } : undefined}
            />
            <KpiCard label="Savings Rate" value={savingsRate !== null ? `${savingsRate}%` : '—'} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
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
      ) : (
        <Card>
          <div className="p-8 text-center text-slate-500 text-sm">No transaction data available.</div>
        </Card>
      )}
    </div>
  );
}
