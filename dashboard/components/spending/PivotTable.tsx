'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDollars, formatMonth } from '@/lib/formatters';

interface ParentRow {
  parentId: number;
  parentName: string;
  colour: string;
  months: Record<string, number>;
  total: number;
  children: ChildRow[];
}

interface ChildRow {
  categoryId: number;
  categoryName: string;
  months: Record<string, number>;
  total: number;
}

function avg(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

export function PivotTable({
  parents,
  monthColumns,
}: {
  parents: ParentRow[];
  monthColumns: string[];
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const monthCount = monthColumns.length;

  function toggle(parentId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }

  // Grand totals per month
  const grandTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const m of monthColumns) {
    grandTotals[m] = parents.reduce((sum, p) => sum + (p.months[m] ?? 0), 0);
    grandTotal += grandTotals[m];
  }

  const thBase = 'px-4 py-3 font-semibold text-slate-400 text-right min-w-[100px] bg-slate-900';

  return (
    <div className="overflow-auto max-h-[calc(100vh-12rem)]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-slate-800">
            <th className="px-4 py-3 font-semibold text-slate-400 text-left sticky left-0 z-30 bg-slate-900 min-w-[200px]">
              Category
            </th>
            {monthColumns.map((m) => (
              <th key={m} className={thBase}>
                {formatMonth(m)}
              </th>
            ))}
            <th className={`${thBase} text-slate-300 min-w-[110px] border-l border-slate-800`}>
              Total
            </th>
            <th className={`${thBase} text-slate-300 min-w-[100px] border-l border-slate-800`}>
              Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {parents.map((parent) => {
            const isExpanded = expanded.has(parent.parentId);
            const hasChildren = parent.children.length > 1;

            return (
              <ParentGroup
                key={parent.parentId}
                parent={parent}
                monthColumns={monthColumns}
                monthCount={monthCount}
                isExpanded={isExpanded}
                hasChildren={hasChildren}
                onToggle={() => toggle(parent.parentId)}
              />
            );
          })}

          {/* Grand total row */}
          <tr className="border-t-2 border-slate-700 bg-slate-800/30">
            <td className="px-4 py-3 font-bold text-slate-100 sticky left-0 bg-slate-800/30">
              Total
            </td>
            {monthColumns.map((m) => (
              <td key={m} className="px-4 py-3 text-right font-bold text-slate-100 tabular-nums">
                {formatDollars(grandTotals[m] ?? 0)}
              </td>
            ))}
            <td className="px-4 py-3 text-right font-bold text-slate-100 tabular-nums border-l border-slate-800">
              {formatDollars(grandTotal)}
            </td>
            <td className="px-4 py-3 text-right font-bold text-slate-100 tabular-nums border-l border-slate-800">
              {formatDollars(avg(grandTotal, monthCount))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ParentGroup({
  parent,
  monthColumns,
  monthCount,
  isExpanded,
  hasChildren,
  onToggle,
}: {
  parent: ParentRow;
  monthColumns: string[];
  monthCount: number;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Parent row */}
      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
        <td className="px-4 py-2.5 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={onToggle}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
              >
                <span className="text-xs">{isExpanded ? '\u25BC' : '\u25B6'}</span>
              </button>
            ) : (
              <span className="w-5" />
            )}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: parent.colour }}
            />
            <Link
              href={`/spending/category/${parent.parentId}`}
              className="font-semibold text-slate-100 hover:text-white transition-colors"
            >
              {parent.parentName}
            </Link>
          </div>
        </td>
        {monthColumns.map((m) => {
          const val = parent.months[m] ?? 0;
          return (
            <td key={m} className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-100">
              {val > 0 ? formatDollars(val) : <span className="text-slate-600">-</span>}
            </td>
          );
        })}
        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-100 border-l border-slate-800">
          {formatDollars(parent.total)}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-300 border-l border-slate-800">
          {formatDollars(avg(parent.total, monthCount))}
        </td>
      </tr>

      {/* Child rows */}
      {isExpanded && parent.children.map((child) => (
        <tr
          key={child.categoryId}
          className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors group"
        >
          <td className="px-4 py-2 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/20 transition-colors">
            <Link
              href={`/spending/category/${child.categoryId}`}
              className="text-slate-400 hover:text-slate-200 transition-colors pl-10 block"
            >
              {child.categoryName}
            </Link>
          </td>
          {monthColumns.map((m) => {
            const val = child.months[m] ?? 0;
            return (
              <td key={m} className="px-4 py-2 text-right tabular-nums text-slate-400">
                {val > 0 ? formatDollars(val) : <span className="text-slate-700">-</span>}
              </td>
            );
          })}
          <td className="px-4 py-2 text-right tabular-nums text-slate-300 border-l border-slate-800">
            {formatDollars(child.total)}
          </td>
          <td className="px-4 py-2 text-right tabular-nums text-slate-400 border-l border-slate-800">
            {formatDollars(avg(child.total, monthCount))}
          </td>
        </tr>
      ))}
    </>
  );
}
