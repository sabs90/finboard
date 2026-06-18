'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyBulkCategorisation } from '@/lib/actions';
import { formatDate } from '@/lib/formatters';
import { Amount } from '@/components/ui/Amount';
import type { TransactionRow, CategorisationSummary, CategoryTreeNode } from '@/lib/db';

interface Edit { parentId: string; childId: string; keyword: string }

const SELECT_CLS =
  'w-36 text-xs border border-slate-700 rounded-md px-2 py-1 bg-slate-800 text-slate-100 focus:border-slate-500 focus:outline-none disabled:opacity-40';

export function CategoriseGrid({
  rows, categoryTree,
}: {
  rows: TransactionRow[];
  categoryTree: CategoryTreeNode[];
}) {
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [result, setResult] = useState<CategorisationSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const childrenByParent = useMemo(() => {
    const m = new Map<string, { id: number; name: string }[]>();
    for (const p of categoryTree) m.set(String(p.id), p.children);
    return m;
  }, [categoryTree]);

  function update(id: number, patch: Partial<Edit>) {
    setEdits((prev) => {
      const current = prev[id] ?? { parentId: '', childId: '', keyword: '' };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }

  const pending = useMemo(
    () => Object.entries(edits).filter(([, e]) => e.parentId !== ''),
    [edits],
  );

  function apply() {
    if (pending.length === 0) return;
    const payload = pending.map(([id, e]) => ({
      transactionId: Number(id),
      categoryId: Number(e.childId || e.parentId),
      keyword: e.keyword,
    }));
    startTransition(async () => {
      const summary = await applyBulkCategorisation(payload);
      setResult(summary);
      setEdits({});
    });
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className="bg-slate-900 rounded-xl border border-emerald-500/30 px-4 py-3 text-sm text-slate-300">
          <span className="text-emerald-400 font-medium">Applied.</span>{' '}
          {result.transactionsUpdated} transaction{result.transactionsUpdated === 1 ? '' : 's'} categorised
          {result.rulesCreated > 0 && (
            <> · {result.rulesCreated} rule{result.rulesCreated === 1 ? '' : 's'} created
              ({result.additionalMatched} matched by keyword)</>
          )}.
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Merchant</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 font-medium">New parent</th>
                <th className="px-4 py-3 font-medium">New child</th>
                <th className="px-4 py-3 font-medium">Keyword (→ rule)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((t) => {
                const e = edits[t.id] ?? { parentId: '', childId: '', keyword: '' };
                const dirty = e.parentId !== '';
                const childOptions = e.parentId ? childrenByParent.get(e.parentId) ?? [] : [];
                return (
                  <tr key={t.id} className={dirty ? 'bg-cyan-500/5' : 'hover:bg-slate-800/30'}>
                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap align-top">{formatDate(t.transaction_date)}</td>
                    <td className="px-4 py-2 text-slate-200 align-top min-w-[260px] max-w-[440px] whitespace-normal break-words">
                      {t.description}
                    </td>
                    <td className="px-4 py-2 text-slate-400 align-top max-w-[160px] break-words">{t.merchant || '—'}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap align-top"><Amount cents={t.amount_cents} /></td>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs align-top">
                      {t.parent_category ? `${t.parent_category} › ${t.category}` : (t.category ?? 'Uncategorised')}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={e.parentId}
                        onChange={(ev) => update(t.id, { parentId: ev.target.value, childId: '' })}
                        className={SELECT_CLS}
                      >
                        <option value="">—</option>
                        {categoryTree.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={e.childId}
                        onChange={(ev) => update(t.id, { childId: ev.target.value })}
                        disabled={!e.parentId || childOptions.length === 0}
                        className={SELECT_CLS}
                      >
                        <option value="">{e.parentId ? '(parent level)' : '—'}</option>
                        {childOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={e.keyword}
                        onChange={(ev) => update(t.id, { keyword: ev.target.value })}
                        placeholder="optional"
                        className="w-32 text-xs border border-slate-700 rounded-md px-2 py-1 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={apply}
          disabled={isPending || pending.length === 0}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white shadow-lg transition-colors"
        >
          {isPending ? 'Applying…' : `Apply ${pending.length} change${pending.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
