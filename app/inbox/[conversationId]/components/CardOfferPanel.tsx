'use client';

import Image from 'next/image';
import { useState } from 'react';
import { MAX_OFFER_CARDS, type CardOffer } from '../../../../lib/cardOffer';
import type { ListingForMeter } from '../../../../lib/fairTrade';
import { filterPickable, type PickableCard } from '../../../../lib/myCards';
import { ListingFairTrade } from '../../../components/ListingFairTrade';
import { classNames } from '../utils';

// "Offer cards": pick cards from your collection (plus optional cash) and see
// the fair-trade meter for that swap before sending it.
export default function CardOfferPanel({
  cards,
  loading,
  loadError,
  listing,
  userId,
  sellerId,
  sending,
  sendError,
  onSend,
  onCancel,
  initialPicked = [],
  initialCash = '',
}: {
  cards: PickableCard[];
  loading: boolean;
  loadError: string;
  listing: ListingForMeter | null;
  userId: string;
  sellerId: string;
  sending: boolean;
  sendError: string;
  onSend: (offer: CardOffer) => void;
  onCancel: () => void;
  // Ids picked when the panel opens, for the demo page.
  initialPicked?: string[];
  initialCash?: string;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>(initialPicked);
  const [cash, setCash] = useState(initialCash);

  const shown = filterPickable(cards, query);
  const chosen = picked
    .map((key) => cards.find((card) => card.key === key))
    .filter((card): card is PickableCard => Boolean(card));
  const cashAmount = Number.parseFloat(cash);
  const offer: CardOffer = {
    cards: chosen.map((card) => ({ id: card.id, name: card.name, variant: card.variant })),
    cash: Number.isFinite(cashAmount) && cashAmount > 0 ? cashAmount : null,
  };
  const full = picked.length >= MAX_OFFER_CARDS;

  function toggle(key: string) {
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : current.length >= MAX_OFFER_CARDS ? current : [...current, key]
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-sky-200/80">Offer cards</p>
        <p className="text-[11px] text-stone-500">
          {picked.length}/{MAX_OFFER_CARDS} picked
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your cards"
        aria-label="Search your cards"
        className="mt-3 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-2.5 text-sm text-white outline-none"
      />

      <div className="mt-3 max-h-56 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-4 text-center text-xs text-stone-400">Loading your cards...</p>
        ) : loadError ? (
          <p className="py-4 text-center text-xs text-rose-200">{loadError}</p>
        ) : cards.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400">
            No cards in your collection yet. Add some in your binder first.
          </p>
        ) : shown.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400">No cards match &ldquo;{query}&rdquo;.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shown.map((card) => {
              const on = picked.includes(card.key);
              return (
                <li key={card.key}>
                  <button
                    type="button"
                    onClick={() => toggle(card.key)}
                    disabled={!on && full}
                    aria-pressed={on}
                    className={classNames(
                      'flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                      on
                        ? 'border-sky-300/40 bg-sky-400/10'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
                      !on && full ? 'cursor-not-allowed opacity-50' : ''
                    )}
                  >
                    <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-stone-900">
                      {card.image ? (
                        <Image src={card.image} alt="" fill sizes="36px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-100">{card.name}</span>
                      <span className="block truncate text-[11px] text-stone-400">
                        #{card.number}
                        {card.variant ? ` · ${card.variant}` : ''}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={classNames(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]',
                        on ? 'border-sky-300 bg-sky-400 text-sky-950' : 'border-white/20'
                      )}
                    >
                      {on ? '✓' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-stone-400">
        <span className="shrink-0">Add cash (optional) £</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={cash}
          onChange={(event) => setCash(event.target.value)}
          placeholder="0"
          className="w-full rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-sm text-white outline-none"
        />
      </label>

      {listing && chosen.length > 0 ? (
        <div className="mt-3">
          <ListingFairTrade
            listing={listing}
            isSeller={userId === sellerId}
            sellerId={sellerId}
            deal={{ kind: 'cards', offer, senderId: userId }}
          />
        </div>
      ) : null}

      {sendError ? <p className="mt-2 text-xs text-rose-200">{sendError}</p> : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/[0.06]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSend(offer)}
          disabled={sending || chosen.length === 0}
          className={classNames(
            'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
            sending || chosen.length === 0
              ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
              : 'bg-sky-400 text-sky-950 hover:bg-sky-300'
          )}
        >
          {sending ? 'Sending…' : 'Send card offer'}
        </button>
      </div>
    </div>
  );
}
