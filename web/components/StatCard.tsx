/** Big number with a label. Colors default to the panel surface. */
export function StatCard({
  value,
  label,
  bgColor,
  textColor = '#ffffff',
  size = 'sm',
}: {
  value: string | number;
  label: string;
  bgColor?: string;
  textColor?: string;
  size?: 'sm' | 'lg';
}) {
  const style = bgColor ? { background: bgColor, color: textColor } : undefined;
  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center rounded-md px-2 text-center ${
        bgColor ? '' : 'border border-line bg-panel text-ink'
      } ${size === 'lg' ? 'py-4' : 'py-2.5'}`}
      style={style}
    >
      <span className={`font-bold tabular-nums leading-none ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>{value}</span>
      <span className={`mt-1.5 text-xs font-medium ${bgColor ? 'opacity-90' : 'text-ink-muted'}`}>{label}</span>
    </div>
  );
}
