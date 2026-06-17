import { getMonthlySpend, getCategoryBreakdown, getMonthTransactions, getAllCategories } from '@/lib/db';
import { getCurrentMonth } from '@/lib/formatters';
import { getCategoryColor } from '@/lib/chartColors';
import { MonthNav } from '@/components/spending/MonthNav';
import { CategoryTable } from '@/components/spending/CategoryTable';
import { TransactionList } from '@/components/transactions/TransactionList';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { SpendingDonut } from '@/components/charts/SpendingDonut';

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

export default function SpendingPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month || getCurrentMonth();

  const spendRows = getMonthlySpend(month);
  const categoryBreakdown = getCategoryBreakdown(month);
  const categories = getAllCategories();
  const donutData = prepareDonutData(categoryBreakdown);
  const transactions = getMonthTransactions(month);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Spending</h1>
        <MonthNav month={month} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <div className="p-6">
            {donutData.length > 0 ? (
              <SpendingDonut data={donutData} />
            ) : (
              <p className="text-sm text-slate-500 text-center py-12">No spending data.</p>
            )}
          </div>
        </Card>

        <div className="lg:col-span-3">
          <CategoryTable
            rows={spendRows}
            month={month}
            selectedCategoryId={null}
          />
        </div>
      </div>

      <TransactionList transactions={transactions} categories={categories} />
    </div>
  );
}
