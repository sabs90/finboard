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
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-500 text-sm">
        No transactions to show.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Transactions ({transactions.length})
        </h2>
      </div>
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
                <td className="px-6 py-3 text-right font-medium text-slate-100 whitespace-nowrap tabular-nums">
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
