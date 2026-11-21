'use client';

import Link from 'next/link';
import { NavIcon, type NavKey } from './components/nav/items';
import { useUnreadMessages } from './components/nav/useUnreadMessages';
import { DemoBanner } from './components/DemoBanner';
import { AllowanceNote, LimitAlert, MatchList } from './matches/MatchList';
import { useMatches } from './matches/useMatches';

type Tile = { key: NavKey; href: string; title: string; body: string; highlight?: boolean };

export default function HomePage() {
  const result = useMatches();
  const unread = useUnreadMessages();
  const { matches, allowance, startError, signedOut } = result;
  const twoWay = matches.filter((match) => match.twoWay).length;

  const tiles: Tile[] = [
    {
      key: 'messages',
      href: '/inbox',
      title: 'Messages',
      body: unread > 0 ? `${unread} unread` : 'No unread messages',
      highlight: unread > 0,
    },
    {
      key: 'matches',
      href: '/matches',
      title: 'Matches',
      body: matches.length > 0 ? `${matches.length} traders, ${twoWay} two-way` : 'See who you can swap with',
    },
    { key: 'binder', href: '/binder', title: 'Binder', body: 'Tick off what you own' },
    { key: 'trade', href: '/trade', title: 'Trade board', body: 'Browse and list cards' },
  ];

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />

        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Your trades</h1>
          <p className="max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            {signedOut
              ? 'Track your binder, find who has the cards you want, and trade at a shop near you.'
              : 'What needs you today, and who you can trade with.'}
          </p>
        </header>

        <nav aria-label="Shortcuts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={tile.href}
              className={`panel flex min-h-24 flex-col justify-between gap-3 p-4 transition-colors hover:border-white/20 ${
                tile.highlight ? 'ring-1 ring-rose-400/40' : ''
              }`}
            >
              <span className="flex items-center justify-between">
                <NavIcon name={tile.key} className="h-6 w-6 text-primary-300" />
                {tile.highlight ? <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{tile.title}</span>
                <span className="block text-xs text-stone-400">{tile.body}</span>
              </span>
            </Link>
          ))}
        </nav>

        <section className="space-y-4" aria-labelledby="top-matches">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-1">
              <h2 id="top-matches" className="text-xl font-semibold text-white">
                Top matches
              </h2>
              <AllowanceNote allowance={allowance} />
            </div>
            {matches.length > 2 ? (
              <Link href="/matches" className="min-h-11 content-center text-sm font-medium text-primary-300 hover:text-primary-200">
                See all {matches.length}
              </Link>
            ) : null}
          </div>
          <LimitAlert message={startError} />
          <MatchList {...result} limit={2} />
        </section>
      </div>
    </main>
  );
}
