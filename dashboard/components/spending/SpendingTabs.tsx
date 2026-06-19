'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/spending', label: 'Breakdown' },
  { href: '/trends', label: 'Trends' },
  { href: '/transactions', label: 'Transactions' },
];

/**
 * Shared tab bar for the Spending hub. Deep Dive is intentionally not a tab —
 * it's a drill-in destination reached by clicking a category.
 */
export function SpendingTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-slate-800">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-cyan-500 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
