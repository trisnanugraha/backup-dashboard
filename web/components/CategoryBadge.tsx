import { CATEGORY_COLORS, UNLABELED } from '@/lib/constants';

export function CategoryBadge({ category }: { category: string }) {
  const label = category || UNLABELED;
  const color = CATEGORY_COLORS[label] ?? CATEGORY_COLORS[UNLABELED];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none"
      style={{ borderColor: color, color }}
    >
      {label}
    </span>
  );
}
