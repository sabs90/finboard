import Link from 'next/link';
import { formatCurrency } from '@/lib/formatters';

interface SubcategoryItem {
  category_id: number;
  category: string;
  total_cents: number;
  color: string;
}

export function SubcategoryBars({
  data,
  parentCategoryId,
}: {
  data: SubcategoryItem[];
  parentCategoryId: number;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No subcategories.</p>;
  }

  const maxCents = data[0].total_cents;

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = maxCents > 0 ? (item.total_cents / maxCents) * 100 : 0;
        return (
          <Link
            key={item.category_id}
            href={`/deep-dive?parent=${parentCategoryId}&sub=${item.category_id}`}
            className="block group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                  {item.category}
                </span>
                <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">
                  &rarr;
                </span>
              </div>
              <span className="text-sm font-medium text-slate-100 tabular-nums ml-3">
                {formatCurrency(item.total_cents)}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
