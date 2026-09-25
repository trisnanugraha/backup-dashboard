'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY } from '@/lib/theme';

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      /* storage unavailable: preference lasts for this page only */
    }
    setDark(next);
  };

  return (
    <button
      className="rounded border border-white/40 px-2.5 py-1 text-sm font-semibold hover:bg-white/10"
      onClick={toggle}
      aria-pressed={dark ?? false}
    >
      {dark ? 'Mode Terang' : 'Mode Gelap'}
    </button>
  );
}
