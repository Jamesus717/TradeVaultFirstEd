'use client';

import type { TradeBoardStats } from '../types';
import { classNames } from '../utils';

type Props = {
  stats: TradeBoardStats;
  hasUser: boolean;
  authLoading: boolean;
  onOpenModal: () => void;
};

export function TradeBoardHeader({ stats, hasUser, authLoading, onOpenModal }: Props) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
      <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-white">Trade Board</h1>
            <p className="mt-2 text-sm text-stone-400">
              Buy, sell and trade Pokemon cards with collectors near you
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                <span className="text-stone-400">Active Listings:</span>{' '}
                <span className="font-semibold text-white">{stats.activeListings}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                <span className="text-stone-400">Traders Online Today:</span>{' '}
                <span className="font-semibold text-white">{stats.tradersToday}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                <span className="text-stone-400">Sets Represented:</span>{' '}
                <span className="font-semibold text-white">{stats.setsRepresented}</span>
              </div>
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
