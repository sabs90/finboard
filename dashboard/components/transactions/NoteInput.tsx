'use client';

import { useState, useTransition } from 'react';
import { setTransactionNote } from '@/lib/actions';

export function NoteInput({ transactionId, note }: { transactionId: number; note: string | null }) {
  const [value, setValue] = useState(note ?? '');
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value.trim() === (note ?? '').trim()) return;
    startTransition(() => setTransactionNote(transactionId, value));
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder="Add note…"
      disabled={isPending}
      className={`w-40 text-xs border border-transparent hover:border-slate-700 focus:border-slate-500 rounded-md px-2 py-1 bg-transparent focus:bg-slate-800 text-slate-300 placeholder:text-slate-600 focus:outline-none ${
        isPending ? 'opacity-50' : ''
      }`}
    />
  );
}
