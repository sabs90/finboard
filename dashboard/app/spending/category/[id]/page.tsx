import Link from 'next/link';
import {
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
import { TransactionList } from '@/components/transactions/TransactionList';
import { notFound } from 'next/navigation';

export default function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { period?: string };
}) {
  const categoryId = parseInt(params.id, 10);
  if (isNaN(categoryId)) notFound();

  const category = getCategoryInfo(categoryId);
  if (!category) notFound();

  const isParent = category.parent_id === null;
  const periodMonths = Math.max(1, Math.min(12, parseInt(searchParams.period ?? '1', 10) || 1));
  const { startDate, endDate } = getDateRange(periodMonths);
  const currentMonth = getCurrentMonth();
  const lastMonth = prevMonth(currentMonth);
  const basePath = `/spending/category/${categoryId}`;

  // Get spending for comparison
  const thisMonthSpend = isParent
    ? getCategorySpendForMonth(categoryId, currentMonth)
    : getSubcategorySpendForMonth(categoryId, currentMonth);
  const lastMonthSpend = isParent
    ? getCategorySpendForMonth(categoryId, lastMonth)
    : getSubcategorySpendForMonth(categoryId, lastMonth);

  // 12-month trend for averages
  const trend12 = isParent
    ? getCategoryMonthlyTrend(categoryId, 12)
    : getSubcategoryMonthlyTrend(categoryId, 12);
  const recentMonths = trend12.slice(-3);
  const avg3Month = recentMonths.length > 0
    ? Math.round(recentMonths.reduce((s, r) => s + r.total_cents, 0) / recentMonths.length)
    : 0;

  // Comparison deltas
  const vsLastMonth = lastMonthSpend > 0
    ? Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100)
    : null;
  const vsAvg = avg3Month > 0
    ? Math.round(((thisMonthSpend - avg3Month) / avg3Month) * 100)
    : null;

  // Subcategories (parent only), merchants, transactions
  const subcategories = isParent
    ? getSubcategoryBreakdown(categoryId, startDate, endDate)
    : [];

  // Build subcategory color map
  const subColorMap = assignSubcategoryColors(subcategories.map((s) => s.category));
  const subcategoriesWithColors = subcategories.map((s) => ({
    ...s,
    color: subColorMap[s.category],
  }));

  // Stacked trend data (parent only)
  let stackedData: Record<string, string | number>[] = [];
  let stackedSubcategories: { name: string; color: string }[] = [];

  if (isParent) {
    const rawStacked = getStackedMonthlyTrend(categoryId, 12);
    // Collect unique subcategory names in spend order
    const subNames = [...new Set(rawStacked.map((r) => r.category))];
    const colorMap = assignSubcategoryColors(subNames);
    stackedSubcategories = subNames.map((name) => ({ name, color: colorMap[name] }));

    // Pivot: one row per month with a key per subcategory
    const monthMap = new Map<string, Record<string, string | number>>();
    for (const row of rawStacked) {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { month: row.month });
      }
      monthMap.get(row.month)![row.category] = row.total_cents;
    }
    stackedData = Array.from(monthMap.values());
  }

  // Simple trend for child categories
  const simpleTrendData = !isParent
    ? trend12.map((r) => ({ month: r.month, total: r.total_cents, isCurrent: r.month === currentMonth }))
    : [];
  const trendAvg = trend12.length > 0
    ? Math.round(trend12.reduce((s, r) => s + r.total_cents, 0) / trend12.length)
    : 0;

  const merchants = isParent
    ? getTopMerchants(categoryId, startDate, endDate)
    : getSubcategoryMerchants(categoryId, startDate, endDate);

  const transactions = isParent
    ? getCategoryDetailTransactions(categoryId, startDate, endDate)
    : getSubcategoryTransactions(categoryId, startDate, endDate);

  const categories = getAllCategories();

  // Back link: if child category, go back to parent; if parent, go to spending
  const backHref = isParent
    ? '/spending'
    : `/spending/category/${category.parent_id}`;
  const backLabel = isParent
    ? 'Back to Spending'
    : `Back to ${category.parent_name}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back link + period selector */}
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          &larr; {backLabel}
        </Link>
        <PeriodSelector basePath={basePath} />
      </div>

      {/* Header scorecard */}
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
          <h1 className="text-2xl font-bold text-slate-100">{category.name}</h1>
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

      {/* Subcategories + Top merchants side by side */}
      <div className={`grid grid-cols-1 ${isParent ? 'lg:grid-cols-2' : ''} gap-4`}>
        {isParent && (
          <Card>
            <CardHeader>
              <CardTitle>Subcategories</CardTitle>
            </CardHeader>
            <div className="p-6">
              <SubcategoryBars data={subcategoriesWithColors} parentCategoryId={categoryId} />
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
      <TransactionList transactions={transactions} categories={categories} />
    </div>
  );
}
