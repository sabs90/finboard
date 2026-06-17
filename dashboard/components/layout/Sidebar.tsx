'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [{ href: '/', label: 'Overview', exact: true }],
  },
  {
    heading: 'Spending',
    items: [
      { href: '/spending', label: 'Spending' },
      { href: '/trends', label: 'Trends' },
      { href: '/deep-dive', label: 'Deep Dive' },
      { href: '/transactions', label: 'Transactions' },
    ],
  },
  {
    heading: 'Planning',
    items: [
      { href: '/budget', label: 'Budget' },
      { href: '/cashflow', label: 'Cash Flow' },
    ],
  },
  {
    heading: 'Wealth',
    items: [
      { href: '/networth', label: 'Net Worth' },
      { href: '/balance-sheet', label: 'Balance Sheet' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-950 text-white flex flex-col border-r border-slate-800">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">Finboard</h1>
      </div>
      <nav className="flex-1 px-3 space-y-4">
        {navSections.map((section, i) => (
          <div key={section.heading ?? i} className="space-y-0.5">
            {section.heading && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
