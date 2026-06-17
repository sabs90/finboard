'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/formatters';

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
  {
    heading: 'Manage',
    items: [
      { href: '/rules', label: 'Category Rules' },
    ],
  },
];

export function Sidebar({ dataAsOf }: { dataAsOf?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-4 bg-slate-950 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="p-2 -ml-2 text-slate-300 hover:text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-white">Finboard</h1>
      </header>

      {/* Backdrop (mobile only, when open) */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-slate-950 text-white flex flex-col border-r border-slate-800 transform transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Finboard</h1>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1 -mr-1 text-slate-400 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-4 overflow-y-auto pb-6">
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
        {dataAsOf && (
          <div className="px-6 py-4 border-t border-slate-800/70">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Data current to</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(dataAsOf)}</p>
          </div>
        )}
      </aside>
    </>
  );
}
