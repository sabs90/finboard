'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/spending', label: 'Spending' },
  { href: '/budget', label: 'Budget' },
  { href: '/cashflow', label: 'Cash Flow' },
  { href: '/networth', label: 'Net Worth' },
  { href: '/transactions', label: 'Transactions' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-950 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">Finboard</h1>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
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
