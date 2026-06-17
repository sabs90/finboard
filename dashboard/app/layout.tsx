import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { getDataFreshness } from '@/lib/db';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Finboard',
  description: 'Personal finance dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { latestTransaction } = getDataFreshness();
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen">
          <Sidebar dataAsOf={latestTransaction} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-[4.5rem] lg:pt-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
