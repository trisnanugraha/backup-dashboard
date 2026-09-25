'use client';

import { APP_CATEGORIES, UNLABELED } from '@/lib/constants';
import { useSaveCategory } from '@/lib/api';
import type { AppCategory } from '@/lib/types';

/** Inline app-category dropdown; saves immediately (optimistic). */
export function CategorySelect({ domain, value }: { domain: string; value: AppCategory }) {
  const save = useSaveCategory();
  return (
    <select
      className="input py-0.5 text-xs"
      aria-label={`Kategori ${domain}`}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => save.mutate({ domain, category: e.target.value as AppCategory })}
    >
      <option value="">{UNLABELED}</option>
      {APP_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
