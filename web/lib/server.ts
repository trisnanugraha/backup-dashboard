import 'server-only';

/** Server-side fetch for the first render (SSR). Returns undefined on failure. */
export async function fetchApi<T>(path: string): Promise<T | undefined> {
  const base = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}
