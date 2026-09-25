import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { themeInitScript } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backup Monitoring',
  description: 'Monitoring backup & verify Kopia',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
