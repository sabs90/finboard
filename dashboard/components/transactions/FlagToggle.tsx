'use client';

import { useState, useTransition } from 'react';
import { toggleTransactionFlag } from '@/lib/actions';

export function FlagToggle({ transactionId, flagged }: { transactionId: number; flagged: boolean }) {
  const [isFlagged, setIsFlagged] = useState(flagged);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !isFlagged;
    setIsFlagged(next);
    startTransition(() => toggleTransactionFlag(transactionId, next));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={isFlagged ? 'Remove flag' : 'Flag transaction'}
      title={isFlagged ? 'Remove flag' : 'Flag transaction'}
      className={`p-1 transition-colors ${isPending ? 'opacity-50' : ''} ${
        isFlagged ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={isFlagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    </button>
  );
}
