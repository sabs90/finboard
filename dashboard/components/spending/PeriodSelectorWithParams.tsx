'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const PERIODS = [
  { value: '1', label: 'This Month' },
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '12M' },
] as const;

export function PeriodSelectorWithParams({ baseParts }: { baseParts: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('period') ?? '1';

  return (
    <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => {
            const allParts = [...baseParts, `period=${p.value}`];
            router.push(`/deep-dive?${allParts.join('&')}`);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            current === p.value
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
