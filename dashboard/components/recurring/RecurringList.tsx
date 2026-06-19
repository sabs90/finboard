import type { RecurringSeries, RecurringCadence } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DismissButton } from '@/components/recurring/RecurringActions';

const CADENCE_LABELS: Record<RecurringCadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const CADENCE_ORDER: RecurringCadence[] = ['monthly', 'quarterly', 'annual'];

function StatusBadge({ s }: { s: RecurringSeries }) {
  if (s.status === 'overdue') {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 whitespace-nowrap">
        Not seen — due {formatDate(s.nextExpectedDate)}
      </span>
    );
  }
  if (s.status === 'price_increase') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 whitespace-nowrap">
        Price ↑ {formatCurrency(s.amountDeltaCents)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
      Next {formatDate(s.nextExpectedDate)}
    </span>
  );
}

function CadenceTable({ rows }: { rows: RecurringSeries[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-400">
            <th className="px-6 py-3 font-medium">Merchant</th>
            <th className="px-6 py-3 font-medium">Category</th>
            <th className="px-6 py-3 font-medium text-right">Typical</th>
            <th className="px-6 py-3 font-medium text-right">Last charge</th>
            <th className="px-6 py-3 font-medium text-right">Per month</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((s) => (
            <tr key={s.merchant} className="hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-3 text-slate-100 whitespace-nowrap">{s.merchant}</td>
              <td className="px-6 py-3">
                {s.category ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.colour || '#9CA3AF' }} />
                    {s.category}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </td>
              <td className="px-6 py-3 text-right tabular-nums text-slate-300">{formatCurrency(s.medianAmountCents)}</td>
              <td className="px-6 py-3 text-right tabular-nums text-slate-400 whitespace-nowrap">
                {formatCurrency(s.lastAmountCents)}
                <span className="block text-xs text-slate-600">{formatDate(s.lastDate)}</span>
              </td>
              <td className="px-6 py-3 text-right tabular-nums font-medium text-slate-100">{formatCurrency(s.monthlyEquivalentCents)}</td>
              <td className="px-6 py-3"><StatusBadge s={s} /></td>
              <td className="px-6 py-3 text-right"><DismissButton merchant={s.merchant} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecurringList({ series }: { series: RecurringSeries[] }) {
  return (
    <div className="space-y-6">
      {CADENCE_ORDER.map((cadence) => {
        const rows = series.filter((s) => s.cadence === cadence);
        if (rows.length === 0) return null;
        const monthlyTotal = rows.reduce((sum, s) => sum + s.monthlyEquivalentCents, 0);
        return (
          <div key={cadence} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                {CADENCE_LABELS[cadence]} · {rows.length}
              </h2>
              <span className="text-sm tabular-nums text-slate-400">
                {formatCurrency(monthlyTotal)}<span className="text-slate-600">/mo</span>
              </span>
            </div>
            <CadenceTable rows={rows} />
          </div>
        );
      })}
    </div>
  );
}
