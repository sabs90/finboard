import { getPivotData } from '@/lib/db';
import { getCurrentMonth, prevMonth } from '@/lib/formatters';
import { Card } from '@/components/ui/Card';
import { PivotTable } from '@/components/spending/PivotTable';
import { SpendingTabs } from '@/components/spending/SpendingTabs';

interface ParentAccum {
  parentId: number;
  parentName: string;
  colour: string;
  months: Record<string, number>;
  total: number;
  childMap: Map<number, {
    categoryId: number;
    categoryName: string;
    months: Record<string, number>;
    total: number;
  }>;
}

export default function TrendsPage() {
  // Build last 6 month columns (current month + 5 prior)
  const current = getCurrentMonth();
  const monthColumns: string[] = [];
  let m = current;
  for (let i = 0; i < 6; i++) {
    monthColumns.unshift(m);
    m = prevMonth(m);
  }

  const rawData = getPivotData(6);

  // Build pivot structure: parent → children → months
  const parentMap = new Map<number, ParentAccum>();

  for (const row of rawData) {
    const pid = row.parent_category_id ?? 0;

    if (!parentMap.has(pid)) {
      parentMap.set(pid, {
        parentId: pid,
        parentName: row.parent_category,
        colour: row.parent_colour,
        months: {},
        total: 0,
        childMap: new Map(),
      });
    }
    const parent = parentMap.get(pid)!;

    // Accumulate into parent totals
    parent.months[row.month] = (parent.months[row.month] ?? 0) + row.total_cents;
    parent.total += row.total_cents;

    // Accumulate into child
    if (row.category_id !== null && row.category !== null) {
      if (!parent.childMap.has(row.category_id)) {
        parent.childMap.set(row.category_id, {
          categoryId: row.category_id,
          categoryName: row.category,
          months: {},
          total: 0,
        });
      }
      const child = parent.childMap.get(row.category_id)!;
      child.months[row.month] = (child.months[row.month] ?? 0) + row.total_cents;
      child.total += row.total_cents;
    }
  }

  // Convert to array, sort by total descending
  const parents = Array.from(parentMap.values())
    .sort((a, b) => b.total - a.total)
    .map((p) => ({
      parentId: p.parentId,
      parentName: p.parentName,
      colour: p.colour,
      months: p.months,
      total: p.total,
      children: Array.from(p.childMap.values()).sort((a, b) => b.total - a.total),
    }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Monthly Trends</h1>
        <span className="text-sm text-slate-400">Last 6 months</span>
      </div>

      <SpendingTabs />

      <Card>
        {parents.length > 0 ? (
          <PivotTable parents={parents} monthColumns={monthColumns} />
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">
            No spending data available.
          </div>
        )}
      </Card>
    </div>
  );
}
