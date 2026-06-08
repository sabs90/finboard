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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Spending by Category
        </h2>
      </div>
      <div className="divide-y divide-gray-50">
        {groups.map((group) => {
          const isParentSelected = selectedCategoryId === group.parentId;
          return (
            <div key={group.parentName}>
              <Link
                href={
                  isParentSelected
                    ? `/spending?month=${month}`
                    : `/spending?month=${month}&cat=${group.parentId}`
                }
                className="flex items-center px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.colour || '#9CA3AF' }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {group.parentName}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(group.totalCents / maxCents) * 100}%`,
                        backgroundColor: group.colour || '#9CA3AF',
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900 ml-4">
                  {formatCurrency(group.totalCents)}
                </span>
              </Link>
              {isParentSelected && (
                <div className="bg-gray-50 px-6 py-1">
                  {group.children.map((child) => (
                    <Link
                      key={child.category_id}
                      href={
                        selectedCategoryId === child.category_id
                          ? `/spending?month=${month}`
                          : `/spending?month=${month}&cat=${child.category_id}`
                      }
                      className={`flex items-center justify-between py-2 pl-5 text-sm ${
                        selectedCategoryId === child.category_id
                          ? 'text-gray-900 font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span>{child.category}</span>
                      <span>{formatCurrency(child.total_cents)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-6 py-3 border-t border-gray-100 flex justify-between">
        <span className="text-sm font-semibold text-gray-900">Total</span>
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(rows.reduce((sum, r) => sum + r.total_cents, 0))}
        </span>
      </div>
    </div>
  );
}
