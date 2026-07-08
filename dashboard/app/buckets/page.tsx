import { getBucketsOverview, getParentCategories } from '@/lib/db';
import { formatDollars } from '@/lib/formatters';
import { KpiCard } from '@/components/ui/KpiCard';
import { BucketList } from '@/components/buckets/BucketList';

export default function BucketsPage() {
  const overview = getBucketsOverview();
  // Income/Transfers/Uncategorised aren't meaningful deduction sources.
  const parentCategories = getParentCategories().filter(
    (p) => !['Income', 'Transfers', 'Uncategorised'].includes(p.name),
  );

  const overAllocated = overview.unallocatedCents !== null && overview.unallocatedCents < 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Savings Buckets</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Virtual envelopes over the offset — the dollars stay in the AMP offset earning the
          mortgage rate; buckets track what they&apos;re spoken for.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Allocated to buckets" value={formatDollars(overview.allocatedCents)} />
        <KpiCard
          label="Offset balance"
          value={overview.offsetCents !== null ? formatDollars(overview.offsetCents) : '—'}
          subtitle="Real cash backing the buckets"
        />
        <KpiCard
          label="Unallocated"
          value={overview.unallocatedCents !== null ? formatDollars(overview.unallocatedCents) : '—'}
          subtitle={overAllocated ? undefined : 'Offset not spoken for'}
        />
        <KpiCard
          label="Monthly accrual"
          value={formatDollars(overview.monthlyAccrualCents)}
          subtitle={`${formatDollars(overview.monthlyAccrualCents * 12)}/yr committed`}
        />
      </div>

      {overAllocated && (
        <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-2.5">
          Buckets total {formatDollars(overview.allocatedCents)} but the offset only holds{' '}
          {formatDollars(overview.offsetCents!)} — you&apos;ve virtually allocated{' '}
          {formatDollars(-overview.unallocatedCents!)} more than exists. Lower some accruals or
          withdraw from a bucket.
        </p>
      )}

      <BucketList buckets={overview.buckets} parentCategories={parentCategories} />
    </div>
  );
}
