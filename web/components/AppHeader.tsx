'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader({ children }: { children?: ReactNode }) {
  const path = usePathname();
  const nav = [
    { href: '/', label: 'Dashboard' },
    { href: '/history', label: 'History' },
  ];
  return (
    <header className="border-b-4 border-accent bg-brand text-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <h1 className="text-lg font-bold tracking-wide">Backup Monitoring</h1>
        <nav className="flex gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded px-3 py-1 text-sm font-semibold ${path === n.href ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
