import { getRecurring, getDismissedRecurring } from '@/lib/db';
import { formatCurrency } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { RecurringList } from '@/components/recurring/RecurringList';
import { RestoreButton } from '@/components/recurring/RecurringActions';

export default function RecurringPage() {
  const series = getRecurring();
  const dismissed = getDismissedRecurring();

  const monthlyTotal = series.reduce((sum, s) => sum + s.monthlyEquivalentCents, 0);
  const priceIncreases = series.filter((s) => s.status === 'price_increase').length;
  const overdue = series.filter((s) => s.status === 'overdue').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Recurring &amp; Subscriptions</h1>
        <span className="text-sm text-slate-400">{series.length} detected</span>
      </div>

      {series.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Monthly cost" value={formatCurrency(monthlyTotal)} subtitle="All recurring, normalised" />
            <KpiCard label="Annualised" value={formatCurrency(monthlyTotal * 12)} />
            <KpiCard label="Price increases" value={String(priceIncreases)} subtitle="Latest charge higher" />
            <KpiCard label="Not seen recently" value={String(overdue)} subtitle="Possible cancellations" />
          </div>

          <RecurringList series={series} />

          <p className="text-xs text-slate-600">
            Detected from transaction history: merchants charged ≥3 times at a regular monthly,
            quarterly or annual cadence. Amounts shown are the typical (median) charge. Use
            <span className="text-slate-500"> Hide</span> to remove expired or one-off series.
          </p>
        </>
      ) : (
        <EmptyState
          title={dismissed.length > 0 ? 'All recurring charges hidden' : 'No recurring charges detected yet'}
          message={
            dismissed.length > 0
              ? 'Every detected series has been hidden. Restore one below to see it again.'
              : 'Once a merchant has been charged at least three times on a regular cadence, it will appear here as a subscription or bill.'
          }
        />
      )}

      {dismissed.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hidden ({dismissed.length})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dismissed.map((m) => (
              <RestoreButton key={m} merchant={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
