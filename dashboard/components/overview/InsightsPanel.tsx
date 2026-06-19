import Link from 'next/link';
import type { InsightData } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface Chip {
  title: string;
  detail: string;
  tone: 'neutral' | 'warning';
  href?: string;
}

function buildChips(data: InsightData): Chip[] {
  const chips: Chip[] = [];

  if (data.biggestMover && Math.abs(data.biggestMover.deltaPct) >= 10) {
    const m = data.biggestMover;
    const up = m.deltaPct >= 0;
    chips.push({
      title: `${m.category} ${up ? 'up' : 'down'} ${Math.abs(m.deltaPct)}%`,
      detail: `${formatCurrency(m.thisMonthCents)} vs ${formatCurrency(m.avgCents)} 3-mo avg`,
      tone: up ? 'warning' : 'neutral',
    });
  }

  if (data.largestTransaction) {
    const t = data.largestTransaction;
    chips.push({
      title: 'Largest transaction',
      detail: `${formatCurrency(t.amountCents)} · ${t.label} · ${formatDate(t.date)}`,
      tone: 'neutral',
    });
  }

  if (data.newMerchant) {
    const n = data.newMerchant;
    chips.push({
      title: `New: ${n.merchant}`,
      detail: `${formatCurrency(n.amountCents)}${n.category ? ` · ${n.category}` : ''}`,
      tone: 'neutral',
    });
  }

  if (data.overBudgetCount > 0) {
    chips.push({
      title: `${data.overBudgetCount} ${data.overBudgetCount === 1 ? 'category' : 'categories'} over budget`,
      detail: 'Review your budget',
      tone: 'warning',
      href: '/budget',
    });
  }

  return chips;
}

export function InsightsPanel({ data }: { data: InsightData }) {
  const chips = buildChips(data);
  if (chips.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {chips.map((chip, i) => {
        const body = (
          <div
            className={`h-full rounded-2xl border px-4 py-3 ${
              chip.tone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-slate-800 bg-slate-900'
            } ${chip.href ? 'hover:border-slate-700 transition-colors' : ''}`}
          >
            <p className="text-sm font-semibold text-slate-100">{chip.title}</p>
            <p className="mt-1 text-xs text-slate-400">{chip.detail}</p>
          </div>
        );
        return chip.href ? (
          <Link key={i} href={chip.href} className="block">{body}</Link>
        ) : (
          <div key={i}>{body}</div>
        );
      })}
    </div>
  );
}
