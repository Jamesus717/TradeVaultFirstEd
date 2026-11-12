import type { MetadataRoute } from 'next';

// Phase 0 of the TradeBinder app: installable from the browser. The icon is a
// placeholder (no Pokémon artwork); swap it for the real mark when there is one.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TradeBinder',
    short_name: 'TradeBinder',
    description: 'Track your Pokémon TCG binder, find who you can trade with, and meet at a local shop.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c0a09',
    theme_color: '#0c0a09',
    categories: ['games', 'shopping', 'social'],
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Messages', url: '/inbox' },
      { name: 'Binder', url: '/binder' },
      { name: 'Trade board', url: '/trade' },
    ],
  };
}
