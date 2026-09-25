// Runtime proxy to the backend API, so the browser only talks to this origin
// (no CORS) and API_URL can change without rebuilding the image.

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = () => (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${API_URL()}/api/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  try {
    const res = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'GET' ? undefined : await req.text(),
      cache: 'no-store',
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return Response.json({ error: 'API tidak dapat dihubungi' }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST };
