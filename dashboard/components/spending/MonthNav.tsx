'use client';

import { useRouter } from 'next/navigation';
import { formatMonth, prevMonth, nextMonth, getCurrentMonth } from '@/lib/formatters';

export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const current = getCurrentMonth();

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => router.push(`/spending?month=${prevMonth(month)}`)}
        className="px-3 py-1 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50"
      >
        &larr;
      </button>
      <span className="text-lg font-semibold text-gray-900 min-w-[120px] text-center">
        {formatMonth(month)}
      </span>
      <button
        onClick={() => router.push(`/spending?month=${nextMonth(month)}`)}
        disabled={month >= current}
        className="px-3 py-1 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        &rarr;
      </button>
    </div>
  );
}
