'use client';

import { useTransition } from 'react';
import { reassignCategory } from '@/lib/actions';
import type { CategoryRow } from '@/lib/db';

export function CategoryPicker({
  transactionId,
  currentCategoryId,
  categories,
}: {
  transactionId: number;
  currentCategoryId: number | null;
  categories: CategoryRow[];
}) {
  const [isPending, startTransition] = useTransition();

  const grouped = new Map<string, CategoryRow[]>();
  for (const cat of categories) {
    const parent = cat.parent_name || 'Other';
    if (!grouped.has(parent)) grouped.set(parent, []);
    grouped.get(parent)!.push(cat);
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCategoryId = parseInt(e.target.value, 10);
    if (isNaN(newCategoryId) || newCategoryId === currentCategoryId) return;
    startTransition(() => {
      reassignCategory(transactionId, newCategoryId);
    });
  }

  return (
    <select
      value={currentCategoryId ?? ''}
      onChange={handleChange}
      disabled={isPending}
      className={`text-xs border border-slate-700 rounded-md px-2 py-1 bg-slate-800 text-slate-200 ${
        isPending ? 'opacity-50' : ''
      }`}
    >
      <option value="">Uncategorised</option>
      {Array.from(grouped.entries()).map(([parent, children]) => (
        <optgroup key={parent} label={parent}>
          {children.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
