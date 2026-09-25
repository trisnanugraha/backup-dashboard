import type { ReactNode } from 'react';

/** Card with a colored title bar, like the Node-RED dashboard groups. */
export function Panel({
  title,
  actions,
  children,
  className = '',
  bodyClassName = 'p-3',
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-2 bg-panel-head px-3 py-2 text-panel-head-ink">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {actions && <div className="flex items-center gap-2 text-ink">{actions}</div>}
      </header>
      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{children}</p>;
}
