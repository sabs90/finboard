'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveBalances } from '@/lib/actions';
import { formatDollars, formatDate } from '@/lib/formatters';
import type { BalanceInputAccount, BalanceGroup, BalanceEntry, SaveBalanceResult } from '@/lib/db';

const GROUP_ORDER: BalanceGroup[] = ['Cash', 'Investments', 'Other', 'Property', 'Mortgages', 'Liabilities'];

const GROUP_LABEL: Record<BalanceGroup, string> = {
  Cash: 'Cash',
  Investments: 'Investments',
  Other: 'Other Assets',
  Property: 'Property',
  Mortgages: 'Mortgages',
  Liabilities: 'Other Liabilities',
};

// Groups that count as liabilities (subtract from net worth).
const LIABILITY_GROUPS = new Set<BalanceGroup>(['Mortgages', 'Liabilities']);

function centsToInput(cents: number | null): string {
  if (cents === null || cents === 0) return '';
  return (cents / 100).toString();
}

function rateToInput(rate: number | null): string {
  if (rate === null) return '';
  return (rate * 100).toString();
}

/** Parse a dollar string to integer cents. Returns null if blank/invalid. */
function parseCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

export function BalanceInputForm({
  accounts,
  defaultDate,
}: {
  accounts: BalanceInputAccount[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.account_id, centsToInput(a.prev_cents)])),
  );
  const [rates, setRates] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      accounts.filter((a) => a.kind === 'loan').map((a) => [a.account_id, rateToInput(a.prev_rate)]),
    ),
  );
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SaveBalanceResult | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<BalanceGroup, BalanceInputAccount[]>();
    for (const a of accounts) {
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group)!.push(a);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, rows: map.get(g)! }));
  }, [accounts]);

  // Live net worth preview: parsed value where present, else previous value.
  const preview = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const a of accounts) {
      const cents = parseCents(values[a.account_id] ?? '') ?? a.prev_cents ?? 0;
      if (LIABILITY_GROUPS.has(a.group)) liabilities += cents;
      else assets += cents;
    }
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [accounts, values]);

  function handleSave() {
    const entries: BalanceEntry[] = [];
    for (const a of accounts) {
      const cents = parseCents(values[a.account_id] ?? '');
      if (cents === null) continue; // skip blanks
      const entry: BalanceEntry = { account_id: a.account_id, kind: a.kind, cents };
      if (a.kind === 'loan') {
        const pct = parseFloat((rates[a.account_id] ?? '').trim());
        entry.rate = isNaN(pct) ? null : pct / 100;
      }
      entries.push(entry);
    }
    setResult(null);
    startTransition(async () => {
      const res = await saveBalances(date, entries);
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Date + summary bar */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 text-sm">
          <span className="text-slate-400 font-medium">As at date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-6 text-sm tabular-nums">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Assets</p>
            <p className="text-slate-300 font-medium">{formatDollars(preview.assets)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Liabilities</p>
            <p className="text-slate-300 font-medium">{formatDollars(preview.liabilities)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Net Worth</p>
            <p className="text-emerald-400 font-semibold text-base">{formatDollars(preview.netWorth)}</p>
          </div>
        </div>
      </div>

      {/* Groups */}
      {grouped.map(({ group, rows }) => (
        <div key={group} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">{GROUP_LABEL[group]}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800/50">
                  <th className="px-6 py-2 font-medium">Account</th>
                  <th className="px-6 py-2 font-medium text-right w-40">Previous</th>
                  <th className="px-6 py-2 font-medium text-right w-40">New balance</th>
                  {group === 'Mortgages' && (
                    <th className="px-6 py-2 font-medium text-right w-28">Rate</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rows.map((a) => (
                  <tr key={a.account_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-2.5 text-slate-200">{a.name}</td>
                    <td className="px-6 py-2.5 text-right tabular-nums text-slate-500">
                      {a.prev_cents !== null ? (
                        <>
                          {formatDollars(a.prev_cents)}
                          {a.prev_date && (
                            <span className="block text-[11px] text-slate-600">{formatDate(a.prev_date)}</span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-2.5 text-right">
                      <div className="relative inline-block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={values[a.account_id] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [a.account_id]: e.target.value }))}
                          placeholder="0"
                          disabled={isPending}
                          className="w-32 text-right text-sm tabular-nums border border-slate-700 rounded-md pl-5 pr-2 py-1 bg-slate-800 text-slate-100 focus:border-slate-500 focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    </td>
                    {group === 'Mortgages' && (
                      <td className="px-6 py-2.5 text-right">
                        <div className="relative inline-block">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={rates[a.account_id] ?? ''}
                            onChange={(e) => setRates((r) => ({ ...r, [a.account_id]: e.target.value }))}
                            placeholder="—"
                            disabled={isPending}
                            className="w-20 text-right text-sm tabular-nums border border-slate-700 rounded-md pl-2 pr-5 py-1 bg-slate-800 text-slate-100 focus:border-slate-500 focus:outline-none disabled:opacity-50"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        {result && (
          <span className="text-sm text-emerald-400">
            Saved {result.accountsUpdated} balances for {result.date.split('-').reverse().join('/')} · Net worth{' '}
            {formatDollars(result.netWorthCents)}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save balances'}
        </button>
      </div>
    </div>
  );
}
