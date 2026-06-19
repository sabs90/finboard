'use client';

import { useState } from 'react';

/**
 * A Card whose body can be collapsed to cut page scroll. The header shows a
 * Show/Hide toggle; secondary charts default to collapsed.
 */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-800 text-left hover:bg-slate-800/40 transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{title}</h2>
        <span className="text-xs font-medium text-slate-400">
          {open ? 'Hide ▲' : 'Show ▼'}
        </span>
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}
