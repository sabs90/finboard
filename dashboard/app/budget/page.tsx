import { getBudgetRows } from '@/lib/db';
import { getCurrentMonth, formatCurrency } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { MonthNav } from '@/components/spending/MonthNav';
import { BudgetEditor } from '@/components/budget/BudgetEditor';

export default function BudgetPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month || getCurrentMonth();
  const rows = getBudgetRows(month);

  const totalBudget = rows.reduce((s, r) => s + r.budget_cents, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent_cents, 0);
  const remaining = totalBudget - totalSpent;
  const budgetedCount = rows.filter((r) => r.budget_cents > 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Budget</h1>
        <MonthNav month={month} basePath="/budget" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Budget" value={totalBudget > 0 ? formatCurrency(totalBudget) : '—'} />
        <KpiCard label="Spent" value={formatCurrency(totalSpent)} />
        <KpiCard
          label="Remaining"
          value={totalBudget > 0 ? formatCurrency(remaining) : '—'}
          trend={totalBudget > 0 ? {
            value: remaining >= 0 ? 'under budget' : 'over budget',
            positive: remaining >= 0,
          } : undefined}
        />
        <KpiCard label="Categories budgeted" value={`${budgetedCount}`} subtitle={`of ${rows.length}`} />
      </div>

      {totalBudget === 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-4 text-sm text-slate-400">
          No budgets set for {month}. Enter a monthly amount against any category below to start tracking.
          Budgets are per-month — set this month, then use the arrows to set future months.
        </div>
      )}

      <BudgetEditor rows={rows} month={month} />
    </div>
  );
}
