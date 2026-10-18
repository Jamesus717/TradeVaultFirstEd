'use client';

import Image from 'next/image';
import type { CardSearchMode, CardSearchResult } from '../types';
import { classNames } from '../utils';

type Props = {
  selectedCard: CardSearchResult | null;
  onSelectCard: (card: CardSearchResult) => void;
  onClearSelectedCard: () => void;
  cardSearchMode: CardSearchMode;
  onChangeCardSearchMode: (mode: CardSearchMode) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  results: CardSearchResult[];
  loading: boolean;
  error: string;
  ownedCards: CardSearchResult[];
};

export function CardSearchStep({
  selectedCard,
  onSelectCard,
  onClearSelectedCard,
  cardSearchMode,
  onChangeCardSearchMode,
  query,
  onChangeQuery,
  results,
  loading,
  error,
  ownedCards,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
        Step 1 — Find your card
      </p>

      {selectedCard ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="h-20 w-14 overflow-hidden rounded-xl bg-stone-950/80 ring-1 ring-white/5">
            {selectedCard.images?.small ? (
              <Image
                src={selectedCard.images.small}
                alt={selectedCard.name}
                width={112}
                height={160}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-stone-500">
                No image
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{selectedCard.name}</p>
            <p className="truncate text-xs text-stone-400">
              {selectedCard.set?.name ?? 'Unknown set'} · #{selectedCard.number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearSelectedCard}
            className="text-sm font-medium text-primary-300 hover:text-primary-200"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeCardSearchMode('collection')}
              className={classNames(
                'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                cardSearchMode === 'collection'
                  ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                  : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
              )}
            >
              My Collection
            </button>
            <button
              type="button"
              onClick={() => onChangeCardSearchMode('all')}
              className={classNames(
                'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                cardSearchMode === 'all'
                  ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                  : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
              )}
            >
              All Cards
            </button>
          </div>

          <input
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder="Search card name e.g. Charizard"
            className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
          />

          {error ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`row-${index}`}
                  className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03]">
              {results.map((card) => {
                const isOwned = ownedCards.some((owned) => owned.id === card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectCard(card)}
                    className="flex w-full items-center gap-3 border-b border-white/10 p-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.05]"
                  >
                    <div className="relative h-16 w-12 overflow-hidden rounded-xl bg-stone-950/80 ring-1 ring-white/5">
                      {card.images?.small ? (
                        <Image
                          src={card.images.small}
                          alt={card.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-500">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{card.name}</p>
                        {cardSearchMode === 'all' && isOwned ? (
                          <span className="rounded-full border border-primary-300/20 bg-primary-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-200">
                            Owned
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-stone-400">
                        {card.set?.name ?? 'Unknown set'} · #{card.number}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim().length >= 2 ? (
            cardSearchMode === 'collection' ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-300">
                <p>No matching cards in your collection.</p>
                <button
                  type="button"
                  onClick={() => onChangeCardSearchMode('all')}
                  className="rounded-2xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300"
                >
                  Search All Cards
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-300">
                No results.
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
