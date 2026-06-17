'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useCallback } from 'react';
import type { AccountRow, CategoryRow } from '@/lib/db';

export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: AccountRow[];
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/transactions?${params.toString()}`);
  }, [router, searchParams]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const value = e.target.value;
    timerRef.current = setTimeout(() => updateParams('q', value), 300);
  }, [updateParams]);

  const grouped = new Map<string, CategoryRow[]>();
  for (const cat of categories) {
    const parent = cat.parent_name || 'Other';
    if (!grouped.has(parent)) grouped.set(parent, []);
    grouped.get(parent)!.push(cat);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="text"
        placeholder="Search transactions..."
        defaultValue={searchParams.get('q') ?? ''}
        onChange={handleSearch}
        className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
      />
      <select
        value={searchParams.get('account') ?? ''}
        onChange={(e) => updateParams('account', e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <select
        value={searchParams.get('category') ?? ''}
        onChange={(e) => updateParams('category', e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
      >
        <option value="">All categories</option>
        {Array.from(grouped.entries()).map(([parent, children]) => (
          <optgroup key={parent} label={parent}>
            {children.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="From date"
          value={searchParams.get('from') ?? ''}
          onChange={(e) => updateParams('from', e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
        <span className="text-slate-500 text-sm">to</span>
        <input
          type="date"
          aria-label="To date"
          value={searchParams.get('to') ?? ''}
          onChange={(e) => updateParams('to', e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
      </div>
    </div>
  );
}
