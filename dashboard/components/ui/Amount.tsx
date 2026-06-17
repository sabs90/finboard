import { formatCurrency } from '@/lib/formatters';

/**
 * Canonical signed-amount display. Convention across the app:
 * inflows (>= 0) are emerald; outflows (< 0) are neutral slate.
 */
export function Amount({ cents, className = '' }: { cents: number; className?: string }) {
  return (
    <span className={`tabular-nums font-medium ${cents >= 0 ? 'text-emerald-400' : 'text-slate-100'} ${className}`}>
      {formatCurrency(cents)}
    </span>
  );
}
