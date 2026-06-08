import Link from 'next/link';
import { formatCurrency } from '@/lib/formatters';
import type { MonthlySpendRow } from '@/lib/db';

interface CategoryGroup {
  parentId: number | null;
  parentName: string;
  colour: string | null;
  totalCents: number;
  children: MonthlySpendRow[];
}

function groupByParent(rows: MonthlySpendRow[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();

  for (const row of rows) {
    const key = row.parent_category || row.category;
    if (!map.has(key)) {
      map.set(key, {
        parentId: row.parent_category_id,
        parentName: key,
        colour: row.colour,
        totalCents: 0,
        children: [],
      });
    }
    const group = map.get(key)!;
    group.totalCents += row.total_cents;
    group.children.push(row);
  }

  return Array.from(map.values()).sort((a, b) => a.totalCents - b.totalCents);
}

export function CategoryTable({
  rows,
  month,
  selectedCategoryId,
}: {
  rows: MonthlySpendRow[];
  month: string;
  selectedCategoryId: number | null;
}) {
  const groups = groupByParent(rows);
  const maxCents = Math.min(...groups.map((g) => g.totalCents));

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Spending by Category
        </h2>
      </div>
      <div className="divide-y divide-slate-800">
        {groups.map((group) => (
          <Link
            key={group.parentName}
            href={group.parentId ? `/spending/category/${group.parentId}` : `/spending?month=${month}`}
            className="flex items-center px-6 py-3 hover:bg-slate-800/50 transition-colors group"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: group.colour || '#9CA3AF' }}
                />
                <span className="text-sm font-medium text-slate-100">
                  {group.parentName}
                </span>
                {group.parentId && (
                  <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">
                    &rarr;
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(group.totalCents / maxCents) * 100}%`,
                    backgroundColor: group.colour || '#9CA3AF',
                  }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-100 ml-4">
              {formatCurrency(group.totalCents)}
            </span>
          </Link>
        ))}
      </div>
      <div className="px-6 py-3 border-t border-slate-800 flex justify-between">
        <span className="text-sm font-semibold text-slate-100">Total</span>
        <span className="text-sm font-semibold text-slate-100">
          {formatCurrency(rows.reduce((sum, r) => sum + r.total_cents, 0))}
        </span>
      </div>
    </div>
  );
}
