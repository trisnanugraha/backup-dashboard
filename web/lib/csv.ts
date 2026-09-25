// Client-side CSV export.

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

/** Trigger a browser download. The BOM keeps Excel reading UTF-8 correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
