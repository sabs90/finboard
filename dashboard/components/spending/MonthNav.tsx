'use client';

import { useRouter } from 'next/navigation';
import { formatMonth, prevMonth, nextMonth, getCurrentMonth } from '@/lib/formatters';

export function MonthNav({ month, basePath = '/spending' }: { month: string; basePath?: string }) {
  const router = useRouter();
  const current = getCurrentMonth();

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => router.push(`${basePath}?month=${prevMonth(month)}`)}
        className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-slate-100 hover:bg-slate-700 transition-colors"
      >
        &larr;
      </button>
      <span className="text-lg font-semibold text-slate-100 min-w-[120px] text-center">
        {formatMonth(month)}
      </span>
      <button
        onClick={() => router.push(`${basePath}?month=${nextMonth(month)}`)}
        disabled={month >= current}
        className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-slate-100 hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        &rarr;
      </button>
    </div>
  );
}
