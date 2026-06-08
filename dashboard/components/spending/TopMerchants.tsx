import { formatCurrency } from '@/lib/formatters';

interface MerchantItem {
  merchant: string;
  total_cents: number;
  transaction_count: number;
}

export function TopMerchants({
  data,
  color,
}: {
  data: MerchantItem[];
  color: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No transactions.</p>;
  }

  const total = data.reduce((sum, m) => sum + m.total_cents, 0);

  return (
    <div className="space-y-2.5">
      {data.map((item, i) => {
        const pct = total > 0 ? (item.total_cents / total) * 100 : 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-slate-500 w-5 text-right">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-200 truncate">{item.merchant}</span>
              </div>
              <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                <span className="text-xs text-slate-500">{item.transaction_count} txn{item.transaction_count !== 1 ? 's' : ''}</span>
                <span className="text-sm font-medium text-slate-100 tabular-nums">
                  {formatCurrency(item.total_cents)}
                </span>
              </div>
            </div>
            <div className="ml-7 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
