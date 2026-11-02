'use client';

import type { TradeBoardStats } from '../types';
import { classNames } from '../utils';

type Props = {
  stats: TradeBoardStats;
  wishlistMatchCount: number;
  onShowWishlistMatches: () => void;
  hasUser: boolean;
  authLoading: boolean;
  onOpenModal: () => void;
};

export function TradeBoardHeader({
  stats,
  wishlistMatchCount,
  onShowWishlistMatches,
  hasUser, authLoading, onOpenModal }: Props) {
  return (
    <section className="hero-panel">
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Meet, swap, sorted</p>
            <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Trade Board</h1>
            <p className="mt-2 text-sm text-stone-400">
              Buy, sell and swap cards with collectors near you. Meet somewhere public, like your local card shop.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                <span className="text-stone-400">Listings</span>{' '}
                <span className="font-semibold text-white">{stats.activeListings}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                <span className="text-stone-400">Traders today</span>{' '}
                <span className="font-semibold text-white">{stats.tradersToday}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                <span className="text-stone-400">Sets</span>{' '}
                <span className="font-semibold text-white">{stats.setsRepresented}</span>
              </div>
              {wishlistMatchCount > 0 ? (
                <button
                  type="button"
                  onClick={onShowWishlistMatches}
                  className="rounded-full border border-primary-300/30 bg-primary-400/15 px-4 py-1.5 text-sm font-semibold text-primary-100 transition-colors hover:bg-primary-400/25"
                >
                  ★ {wishlistMatchCount} {wishlistMatchCount === 1 ? 'listing matches' : 'listings match'} your wishlist
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenModal}
              disabled={!hasUser || authLoading}
              title={!hasUser ? 'Sign in to list a card' : undefined}
              className={classNames(
                'rounded-2xl px-6 py-3 text-sm font-semibold transition-colors',
                hasUser
                  ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                  : 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
              )}
            >
              List a Card
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
