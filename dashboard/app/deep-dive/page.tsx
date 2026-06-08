import { redirect } from 'next/navigation';
import {
  getParentCategories,
  getChildCategories,
  getCategoryInfo,
  getCategoryMonthlyTrend,
  getStackedMonthlyTrend,
  getSubcategoryBreakdown,
  getTopMerchants,
  getCategoryDetailTransactions,
  getCategorySpendForMonth,
  getSubcategorySpendForMonth,
  getSubcategoryMonthlyTrend,
  getSubcategoryMerchants,
  getSubcategoryTransactions,
  getAllCategories,
} from '@/lib/db';
import { formatCurrency, getCurrentMonth, prevMonth, getDateRange } from '@/lib/formatters';
import { assignSubcategoryColors } from '@/lib/chartColors';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { CategoryTrendChart } from '@/components/charts/CategoryTrendChart';
import { StackedTrendChart } from '@/components/charts/StackedTrendChart';
import { SubcategoryBars } from '@/components/spending/SubcategoryBars';
import { TopMerchants } from '@/components/spending/TopMerchants';
import { PeriodSelector } from '@/components/spending/PeriodSelector';
import { CategorySelector } from '@/components/spending/CategorySelector';
import { TransactionList } from '@/components/transactions/TransactionList';
import { PeriodSelectorWithParams } from '@/components/spending/PeriodSelectorWithParams';

export default function DeepDivePage({
  searchParams,
}: {
  searchParams: {
    parent?: string;
    sub?: string;
    period?: string;
  };
}) {
  const parents = getParentCategories();
  const selectedParentId = searchParams.parent ? parseInt(searchParams.parent, 10) : null;
  const selectedChildId = searchParams.sub ? parseInt(searchParams.sub, 10) : null;

  const children = selectedParentId ? getChildCategories(selectedParentId) : [];

  // If no category selected, show the selector only
  if (!selectedParentId) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Category Deep Dive</h1>
        <p className="text-slate-400 text-sm">Select a category to explore spending patterns, subcategory breakdowns, and merchant details.</p>
        <Card>
          <div className="p-6">
            <CategorySelector
              parents={parents}
              children={children}
              selectedParentId={selectedParentId}
              selectedChildId={selectedChildId}
            />
          </div>
        </Card>

        {/* Quick links to all parent categories */}
        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
          </CardHeader>
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {parents.map((p) => (
              <a
                key={p.id}
                href={`/deep-dive?parent=${p.id}`}
                className="flex items-center gap-2.5 px-4 py-3 bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 hover:bg-slate-750 transition-colors group"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.colour }}
                />
                <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
                  {p.name}
                </span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Category is selected — show the full deep dive inline
  const activeId = selectedChildId ?? selectedParentId;
  const category = getCategoryInfo(activeId);
  if (!category) return redirect('/deep-dive');

  const isParent = category.parent_id === null;
  const periodMonths = Math.max(1, Math.min(12, parseInt(searchParams.period ?? '1', 10) || 1));
  const { startDate, endDate } = getDateRange(periodMonths);
  const currentMonth = getCurrentMonth();
  const lastMonth = prevMonth(currentMonth);

  // Spend comparisons
  const thisMonthSpend = isParent
    ? getCategorySpendForMonth(activeId, currentMonth)
    : getSubcategorySpendForMonth(activeId, currentMonth);
  const lastMonthSpend = isParent
    ? getCategorySpendForMonth(activeId, lastMonth)
    : getSubcategorySpendForMonth(activeId, lastMonth);

  const trend12 = isParent
    ? getCategoryMonthlyTrend(activeId, 12)
    : getSubcategoryMonthlyTrend(activeId, 12);
  const recentMonths = trend12.slice(-3);
  const avg3Month = recentMonths.length > 0
    ? Math.round(recentMonths.reduce((s, r) => s + r.total_cents, 0) / recentMonths.length)
    : 0;

  const vsLastMonth = lastMonthSpend > 0
    ? Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100)
    : null;
  const vsAvg = avg3Month > 0
    ? Math.round(((thisMonthSpend - avg3Month) / avg3Month) * 100)
    : null;

  // Subcategories + stacked trend (parent only)
  const subcategories = isParent
    ? getSubcategoryBreakdown(activeId, startDate, endDate)
    : [];
  const subColorMap = assignSubcategoryColors(subcategories.map((s) => s.category));
  const subcategoriesWithColors = subcategories.map((s) => ({
    ...s,
    color: subColorMap[s.category],
  }));

  let stackedData: Record<string, string | number>[] = [];
  let stackedSubcategories: { name: string; color: string }[] = [];

  if (isParent) {
    const rawStacked = getStackedMonthlyTrend(activeId, 12);
    const subNames = [...new Set(rawStacked.map((r) => r.category))];
    const colorMap = assignSubcategoryColors(subNames);
    stackedSubcategories = subNames.map((name) => ({ name, color: colorMap[name] }));
    const monthMap = new Map<string, Record<string, string | number>>();
    for (const row of rawStacked) {
      if (!monthMap.has(row.month)) monthMap.set(row.month, { month: row.month });
      monthMap.get(row.month)![row.category] = row.total_cents;
    }
    stackedData = Array.from(monthMap.values());
  }

  const simpleTrendData = !isParent
    ? trend12.map((r) => ({ month: r.month, total: r.total_cents, isCurrent: r.month === currentMonth }))
    : [];
  const trendAvg = trend12.length > 0
    ? Math.round(trend12.reduce((s, r) => s + r.total_cents, 0) / trend12.length)
    : 0;

  const merchants = isParent
    ? getTopMerchants(activeId, startDate, endDate)
    : getSubcategoryMerchants(activeId, startDate, endDate);

  const transactions = isParent
    ? getCategoryDetailTransactions(activeId, startDate, endDate)
    : getSubcategoryTransactions(activeId, startDate, endDate);

  const allCategories = getAllCategories();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Category Deep Dive</h1>

      {/* Category selectors */}
      <Card>
        <div className="p-6">
          <CategorySelector
            parents={parents}
            children={children}
            selectedParentId={selectedParentId}
            selectedChildId={selectedChildId}
          />
        </div>
      </Card>

      {/* Scorecard + period selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
            style={{ backgroundColor: category.colour + '20' }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: category.colour }}
            />
          </div>
          <div>
            {!isParent && (
              <p className="text-xs text-slate-400 mb-0.5">{category.parent_name}</p>
            )}
            <h2 className="text-xl font-bold text-slate-100">{category.name}</h2>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-3xl font-bold text-slate-100 tabular-nums">
                {formatCurrency(thisMonthSpend)}
              </span>
              {vsLastMonth !== null && (
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  vsLastMonth <= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {vsLastMonth > 0 ? '\u2191' : '\u2193'} {Math.abs(vsLastMonth)}% vs last month
                </span>
              )}
              {vsAvg !== null && (
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  vsAvg <= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {vsAvg > 0 ? '\u2191' : '\u2193'} {Math.abs(vsAvg)}% vs 3mo avg
                </span>
              )}
            </div>
          </div>
        </div>
        <PeriodSelectorWithParams baseParts={[
          ...(selectedParentId ? [`parent=${selectedParentId}`] : []),
          ...(selectedChildId ? [`sub=${selectedChildId}`] : []),
        ]} />
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend (12 months)</CardTitle>
        </CardHeader>
        <div className="p-6">
          {isParent ? (
            stackedData.length > 0 ? (
              <StackedTrendChart data={stackedData} subcategories={stackedSubcategories} />
            ) : (
              <p className="text-sm text-slate-500 text-center py-12">No historical data.</p>
            )
          ) : (
            simpleTrendData.length > 0 ? (
              <CategoryTrendChart data={simpleTrendData} color={category.colour} average={trendAvg} />
            ) : (
              <p className="text-sm text-slate-500 text-center py-12">No historical data.</p>
            )
          )}
        </div>
      </Card>

      {/* Subcategories + Merchants */}
      <div className={`grid grid-cols-1 ${isParent ? 'lg:grid-cols-2' : ''} gap-4`}>
        {isParent && (
          <Card>
            <CardHeader>
              <CardTitle>Subcategories</CardTitle>
            </CardHeader>
            <div className="p-6">
              <SubcategoryBars data={subcategoriesWithColors} parentCategoryId={activeId} />
            </div>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
          </CardHeader>
          <div className="p-6">
            <TopMerchants data={merchants} color={category.colour} />
          </div>
        </Card>
      </div>

      {/* Transactions */}
      <TransactionList transactions={transactions} categories={allCategories} />
    </div>
  );
}
