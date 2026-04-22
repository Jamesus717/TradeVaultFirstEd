import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from './auth';
import Navbar from './navbar';

export const metadata: Metadata = {
  title: 'TradeVault — Pokémon TCG collection tracker & trading platform',
  description:
    'Track Pokémon TCG collections, completion, variants, and wishlist, plus manage trades with other collectors.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ scrollbarGutter: 'stable' }}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
