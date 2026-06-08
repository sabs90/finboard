import { formatCurrency, formatDate } from '@/lib/formatters';
import { CategoryPicker } from './CategoryPicker';
import type { TransactionRow, CategoryRow } from '@/lib/db';

export function TransactionList({
  transactions,
  categories,
}: {
  transactions: TransactionRow[];
  categories: CategoryRow[];
}) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
        No transactions to show.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Transactions ({transactions.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Account</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(txn.transaction_date)}
                </td>
                <td className="px-6 py-3 text-gray-900">
                  {txn.merchant || txn.description}
                </td>
                <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                  {txn.account_name}
                </td>
                <td className="px-6 py-3">
                  <CategoryPicker
                    transactionId={txn.id}
                    currentCategoryId={txn.category_id}
                    categories={categories}
                  />
                </td>
                <td className="px-6 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                  {formatCurrency(txn.amount_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
