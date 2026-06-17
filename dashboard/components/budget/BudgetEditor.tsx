'use client';

import { useState, useTransition } from 'react';
import { setBudget } from '@/lib/actions';
import { formatCurrency } from '@/lib/formatters';
import type { BudgetRow } from '@/lib/db';

interface ParentGroup {
  parentId: number;
  parentName: string;
  colour: string;
  children: BudgetRow[];
  budgetTotal: number;
  spentTotal: number;
  avg6Total: number;
}

function groupByParent(rows: BudgetRow[]): ParentGroup[] {
  const map = new Map<number, ParentGroup>();
  for (const r of rows) {
    if (!map.has(r.parent_id)) {
      map.set(r.parent_id, {
        parentId: r.parent_id,
        parentName: r.parent_category,
        colour: r.colour,
        children: [],
        budgetTotal: 0,
        spentTotal: 0,
        avg6Total: 0,
      });
    }
    const g = map.get(r.parent_id)!;
    g.children.push(r);
    g.budgetTotal += r.budget_cents;
    g.spentTotal += r.spent_cents;
    g.avg6Total += r.avg6_cents;
  }
  return Array.from(map.values());
}

function ProgressBar({ spent, budget }: { spent: number; budget: number }) {
  if (budget <= 0) {
    return <div className="h-1.5 rounded-full bg-slate-800" />;
  }
  const pct = Math.min(100, Math.round((spent / budget) * 100));
  const over = spent > budget;
  return (
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div
        className={`h-full rounded-full ${over ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${over ? 100 : pct}%` }}
      />
    </div>
  );
}

function centsToInput(cents: number): string {
  if (cents <= 0) return '';
  return (cents / 100).toString();
}

function BudgetRowCells({ row, month }: { row: BudgetRow; month: string }) {
  const [value, setValue] = useState(centsToInput(row.budget_cents));
  const [isPending, startTransition] = useTransition();

  function persist(cents: number) {
    if (cents === row.budget_cents) return;
    startTransition(() => setBudget(row.category_id, month, cents));
  }

  function saveFromInput() {
    const dollars = parseFloat(value);
    persist(isNaN(dollars) ? 0 : Math.round(dollars * 100));
  }

  function applyAvg() {
    if (row.avg6_cents <= 0) return;
    setValue(centsToInput(row.avg6_cents));
    persist(row.avg6_cents);
  }

  const remaining = row.budget_cents - row.spent_cents;
  const over = row.budget_cents > 0 && row.spent_cents > row.budget_cents;

  return (
    <tr className="hover:bg-slate-800/30 transition-colors">
      <td className="px-6 py-2.5 text-slate-200">{row.category}</td>
      <td className="px-6 py-2.5 text-right tabular-nums text-slate-300">
        {formatCurrency(row.spent_cents)}
      </td>
      <td className="px-6 py-2.5 text-right">
        {row.avg6_cents > 0 ? (
          <button
            type="button"
            onClick={applyAvg}
            title="Set budget to this amount"
            className="tabular-nums text-slate-500 hover:text-emerald-400 hover:underline cursor-pointer transition-colors"
          >
            {formatCurrency(row.avg6_cents)}
          </button>
        ) : (
          <span className="tabular-nums text-slate-600">—</span>
        )}
      </td>
      <td className="px-6 py-2.5 text-right">
        <div className="relative inline-block">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="10"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={saveFromInput}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="0"
            disabled={isPending}
            className={`w-24 text-right text-sm tabular-nums border border-slate-700 rounded-md pl-5 pr-2 py-1 bg-slate-800 text-slate-100 focus:border-slate-500 focus:outline-none ${
              isPending ? 'opacity-50' : ''
            }`}
          />
        </div>
      </td>
      <td className={`px-6 py-2.5 text-right tabular-nums ${
        row.budget_cents <= 0 ? 'text-slate-600' : over ? 'text-rose-400' : 'text-slate-300'
      }`}>
        {row.budget_cents > 0 ? formatCurrency(remaining) : '—'}
      </td>
      <td className="px-6 py-2.5">
        <ProgressBar spent={row.spent_cents} budget={row.budget_cents} />
      </td>
    </tr>
  );
}

export function BudgetEditor({ rows, month }: { rows: BudgetRow[]; month: string }) {
  const groups = groupByParent(rows);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.parentId} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.colour }} />
              <h2 className="text-sm font-semibold text-slate-200">{g.parentName}</h2>
            </div>
            <span className="text-xs tabular-nums text-slate-400">
              {formatCurrency(g.spentTotal)} / {g.budgetTotal > 0 ? formatCurrency(g.budgetTotal) : '—'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800/50">
                <th className="px-6 py-2 font-medium">Category</th>
                <th className="px-6 py-2 font-medium text-right w-28">Spent</th>
                <th className="px-6 py-2 font-medium text-right w-28">6mo Avg</th>
                <th className="px-6 py-2 font-medium text-right w-32">Budget</th>
                <th className="px-6 py-2 font-medium text-right w-28">Remaining</th>
                <th className="px-6 py-2 font-medium w-40">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {g.children.map((c) => (
                <BudgetRowCells key={c.category_id} row={c} month={month} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
