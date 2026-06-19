import { getBalanceInputAccounts, getLatestSnapshotDate } from '@/lib/db';
import { BalanceInputForm } from '@/components/balance-sheet/BalanceInputForm';

/** Next quarter-end date after the latest snapshot (or this quarter if none). */
function nextQuarterEnd(latest: string | null): string {
  let year: number;
  let month: number; // 1-12
  if (latest) {
    const [y, m] = latest.split('-').map(Number);
    month = m + 3;
    year = y;
    if (month > 12) {
      month -= 12;
      year += 1;
    }
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  // last day of `month` = day 0 of the following month
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export default function BalanceInputPage() {
  const accounts = getBalanceInputAccounts();
  const latest = getLatestSnapshotDate();
  const defaultDate = nextQuarterEnd(latest);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Update Balances</h1>
        {latest && (
          <span className="text-sm text-slate-500">
            Last snapshot: {latest.split('-').reverse().join('/')}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 -mt-2">
        Each field is pre-filled with its most recent value. Edit what changed, pick the
        as-at date, and save — the net worth snapshot recalculates automatically.
      </p>
      <BalanceInputForm accounts={accounts} defaultDate={defaultDate} />
    </div>
  );
}
