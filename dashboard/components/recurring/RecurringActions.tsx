'use client';

import { useTransition } from 'react';
import { hideRecurring, unhideRecurring } from '@/lib/actions';

export function DismissButton({ merchant }: { merchant: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => hideRecurring(merchant))}
      title={`Hide ${merchant} from recurring`}
      className="text-xs text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
    >
      {pending ? 'Hiding…' : 'Hide'}
    </button>
  );
}

export function RestoreButton({ merchant }: { merchant: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => unhideRecurring(merchant))}
      className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors disabled:opacity-40"
    >
      <span className="text-slate-500">{merchant}</span>
      <span className="text-slate-500">·</span>
      {pending ? 'Restoring…' : 'Restore'}
    </button>
  );
}
