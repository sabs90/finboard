'use client';

import { useState, useTransition } from 'react';
import { runRecategorise } from '@/app/rules/actions';

export function RecategoriseButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; updated: number | null } | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await runRecategorise();
      setResult({ ok: res.ok, updated: res.updated });
    });
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Re-apply rules</h2>
      <p className="text-sm text-slate-500">
        Runs every current rule against transactions still sitting in Uncategorised. Use after adding
        rules to catch older transactions that were imported before the rule existed. Already-categorised
        and flagged transactions are left untouched.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
        >
          {isPending ? 'Re-applying…' : 'Re-apply rules to Uncategorised'}
        </button>
        {result && (
          <span className={`text-sm ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
            {result.ok
              ? `Done — categorised ${result.updated ?? 0} transaction${result.updated === 1 ? '' : 's'}.`
              : 'Failed — check the server logs.'}
          </span>
        )}
      </div>
    </div>
  );
}
