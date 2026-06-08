import { searchTransactions, getAllCategories, getAccounts } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { CategoryPicker } from '@/components/transactions/CategoryPicker';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import { Pagination } from '@/components/transactions/Pagination';

const PAGE_SIZE = 30;

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    account?: string;
    category?: string;
    month?: string;
    page?: string;
  };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const accountId = searchParams.account ? parseInt(searchParams.account, 10) : undefined;
  const categoryId = searchParams.category ? parseInt(searchParams.category, 10) : undefined;

  const { transactions, total } = searchTransactions({
    query: searchParams.q,
    accountId: isNaN(accountId as number) ? undefined : accountId,
    categoryId: isNaN(categoryId as number) ? undefined : categoryId,
    month: searchParams.month,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const accounts = getAccounts();
  const categories = getAllCategories();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Transactions</h1>

      <TransactionFilters accounts={accounts} categories={categories} />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>
            {total.toLocaleString()} transaction{total !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Account</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3 text-slate-400 whitespace-nowrap">
                      {formatDate(txn.transaction_date)}
                    </td>
                    <td className="px-6 py-3 text-slate-100">
                      {txn.merchant || txn.description}
                    </td>
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                      {txn.account_name}
                    </td>
                    <td className="px-6 py-3">
                      <CategoryPicker
                        transactionId={txn.id}
                        currentCategoryId={txn.category_id}
                        categories={categories}
                      />
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
            No transactions match your filters.
          </div>
        )}
      </Card>

      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}
