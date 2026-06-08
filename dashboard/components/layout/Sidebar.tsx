'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Overview', exact: true },
  { href: '/spending', label: 'Spending', exact: false },
  { href: '/deep-dive', label: 'Deep Dive', exact: false },
  { href: '/budget', label: 'Budget', exact: false },
  { href: '/cashflow', label: 'Cash Flow', exact: false },
  { href: '/networth', label: 'Net Worth', exact: false },
  { href: '/transactions', label: 'Transactions', exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-950 text-white flex flex-col border-r border-slate-800">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">Finboard</h1>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
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
      </nav>
    </aside>
  );
}
