'use client';

import { EmptyState } from '../components/EmptyState';
import { MatchCard } from '../components/MatchCard';
import type { Allowance, useMatches } from './useMatches';

type Props = ReturnType<typeof useMatches> & { limit?: number };

export function AllowanceNote({ allowance }: { allowance: Allowance | null }) {
  if (!allowance) {
    return null;
  }
  const left = Math.max(0, allowance.daily_limit - allowance.used);
  return (
    <p className="text-sm text-stone-400">
      <span className="font-semibold text-stone-200">{left}</span> of {allowance.daily_limit} new match chats left today
    </p>
  );
}

export function LimitAlert({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  const isLimit = message.startsWith('Daily match limit');
  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 text-sm ${
        isLimit ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-rose-300/20 bg-rose-500/10 text-rose-100'
      }`}
    >
      <p className="font-semibold">{message}</p>
      {isLimit ? (
        <p className="mt-1 text-amber-100/80">
          You can still reply in Messages. Free accounts start up to 10 new match chats a day.
        </p>
      ) : null}
    </div>
  );
}

export function MatchList({ signedOut, authLoading, state, matches, startingId, startTrade, limit }: Props) {
  if (signedOut) {
    return (
      <EmptyState
        title="Sign in to see your matches"
        body="Add your cards and your wishlist, and we'll find who you can trade with."
        action={{ label: 'Open the binder', href: '/binder' }}
      />
    );
  }
  if (authLoading || state === 'loading') {
    return <div className="panel h-64 animate-pulse" />;
  }
  if (state === 'error') {
    return (
      <EmptyState
        title="Matches didn't load"
        body="Check your connection, then reload the page."
        action={{ label: 'Reload', onClick: () => window.location.reload() }}
      />
    );
  }
  if (state === 'not-migrated') {
    return (
      <EmptyState
        title="Matching is on its way"
        body="Keep your binder and wishlist up to date and your matches will be ready when it starts."
        action={{ label: 'Open the binder', href: '/binder' }}
      />
    );
  }
  if (matches.length === 0) {
    return (
      <EmptyState
        title="No matches yet"
        body="Add cards to your wishlist and mark spares for trade to find people to swap with."
        action={{ label: 'Add to your wishlist', href: '/wishlist' }}
      />
    );
  }
  return (
    <div className="space-y-4">
      {(limit ? matches.slice(0, limit) : matches).map((match) => (
        <MatchCard
          key={match.traderId}
          match={match}
          starting={startingId === match.traderId}
          onStart={() => startTrade(match)}
        />
      ))}
    </div>
  );
}
