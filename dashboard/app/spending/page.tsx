import { getMonthlySpend, getCategoryTransactions, getMonthTransactions, getAllCategories } from '@/lib/db';
import { getCurrentMonth } from '@/lib/formatters';
import { MonthNav } from '@/components/spending/MonthNav';
import { CategoryTable } from '@/components/spending/CategoryTable';
import { TransactionList } from '@/components/transactions/TransactionList';

export default function SpendingPage({
  searchParams,
}: {
  searchParams: { month?: string; cat?: string };
}) {
  const month = searchParams.month || getCurrentMonth();
  const selectedCategoryId = searchParams.cat ? parseInt(searchParams.cat, 10) : null;

  const spendRows = getMonthlySpend(month);
  const categories = getAllCategories();

  const transactions = selectedCategoryId
    ? getCategoryTransactions(month, selectedCategoryId)
    : getMonthTransactions(month);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Spending</h1>
        <MonthNav month={month} />
      </div>
      <CategoryTable
        rows={spendRows}
        month={month}
        selectedCategoryId={selectedCategoryId}
      />
      <TransactionList transactions={transactions} categories={categories} />
    </div>
  );
}
