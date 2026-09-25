import type { HostDetail } from '@/lib/types';

export function AlertBanner({ hosts }: { hosts: HostDetail[] }) {
  const failed = hosts.filter((h) => h.status === 'ERROR');
  if (!failed.length) {
    return (
      <div role="status" className="rounded-lg bg-ok px-4 py-2.5 text-sm font-semibold text-white">
        Semua host backup OK
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-lg bg-err px-4 py-2.5 text-sm text-white">
      <span className="font-bold">PERHATIAN: {failed.length} host gagal backup</span>
      <span className="opacity-95"> — {failed.map((h) => h.host).join(', ')}</span>
    </div>
  );
}
