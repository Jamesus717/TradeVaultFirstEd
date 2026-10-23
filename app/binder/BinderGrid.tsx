'use client';

import { memo, useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { EmptyState } from '../components/EmptyState';
import type { CardVariant } from './types';
import { usePriceData } from './hooks/usePriceData';

type Props = {
  cards: CardVariant[];
  owned: Record<string, boolean>;
  savingId: string | null;
  bulkSaving: boolean;
  canEdit: boolean;
  onToggleOwned: (card: CardVariant) => void;
  onCardClick: (card: CardVariant) => void;
};

export function BinderGrid({ cards, owned, savingId, bulkSaving, canEdit, onToggleOwned, onCardClick }: Props) {
  if (cards.length === 0) {
    return (
      <EmptyState
        compact
        title="No cards match"
        body="Try a different name, or switch the filter back to All Cards."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {cards.map((card) => (
        <BinderCard
          key={card.id}
          card={card}
          isOwned={Boolean(owned[card.id])}
          isSaving={savingId === card.id}
          bulkSaving={bulkSaving}
          canEdit={canEdit}
          onToggleOwned={onToggleOwned}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}

type BinderCardProps = {
  card: CardVariant;
  isOwned: boolean;
  isSaving: boolean;
  bulkSaving: boolean;
  canEdit: boolean;
  onToggleOwned: (card: CardVariant) => void;
  onCardClick: (card: CardVariant) => void;
};

/**
 * Memoised so that typing in the binder search does not re-render every
 * card in the set. A set can be ~500 variants, each with its own
 * IntersectionObserver and price subscription; reconciling all of them on
 * each keystroke was the bulk of the input lag.
 *
 * The props are deliberately flat primitives plus the card object (stable
 * identity, it comes straight from the set cache) and the two callbacks,
 * which the page holds stable with `useCallback`. Filtering the list no
 * longer touches the cards that survive the filter.
 */
const BinderCard = memo(function BinderCard({
  card,
  isOwned,
  isSaving,
  bulkSaving,
  canEdit,
  onToggleOwned,
  onCardClick,
}: BinderCardProps) {
  return (
    <article onClick={() => onCardClick(card)} className="group cursor-pointer">
      <div className={`tcg-card ${isOwned ? 'is-owned' : 'is-missing'}`}>
        {card.image ? (
          <Image
            src={card.image}
            alt={`${card.name} ${card.variant}`}
            width={245}
            height={342}
            sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-500">
            No image
          </div>
        )}
        {card.variant !== 'Normal' && card.variant !== 'Unlimited' ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-100 backdrop-blur">
            {card.variant}
          </span>
        ) : null}
        {isOwned ? (
          <span
            aria-label="Owned"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-primary-950 shadow-lg"
          >
            ✓
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-start justify-between gap-1">
          <h2 className="line-clamp-1 text-sm font-semibold leading-snug text-white">
            {card.name}
          </h2>
          <CardPriceBadge card={card} isOwned={isOwned} />
        </div>
        <p className="text-xs text-stone-400">#{card.number}</p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleOwned(card);
        }}
        disabled={!canEdit || isSaving || bulkSaving}
        className={`mt-2 min-h-11 w-full rounded-xl px-3 text-xs font-semibold transition-colors ${
          isOwned
            ? 'bg-primary-400/15 text-primary-200 ring-1 ring-primary-300/30 hover:bg-primary-400/25'
            : 'bg-white/[0.05] text-stone-200 ring-1 ring-white/10 hover:bg-white/[0.1]'
        } ${!canEdit || isSaving || bulkSaving ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {isSaving ? 'Saving...' : isOwned ? 'In binder ✓' : '+ Add to binder'}
      </button>
    </article>
  );
});

function CardPriceBadge({ 
  card,
  isOwned,
}: { 
  card: CardVariant;
  isOwned: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const price = usePriceData(
    card.baseCardId,
    card.name,
    card.setName,
    card.variant,
    visible && isOwned
  );

  if (!isOwned) {
    return <span ref={ref} />;
  }

  if (price.error === 'Rate limit reached') {
    return <span ref={ref} />;
  }

  if (price.loading) {
    return (
      <span 
        ref={ref}
        className="shrink-0 text-[11px] font-semibold text-stone-600 leading-snug pt-[1px]"
      >
        ...
      </span>
    );
  }

  if (price.error || price.priceMid === null) {
    return (
      <span 
        ref={ref}
        className="shrink-0 text-[11px] text-stone-600 leading-snug pt-[1px]"
      >
        —
      </span>
    );
  }

  return (
    <span
      ref={ref}
      className="shrink-0 text-[11px] font-semibold text-primary-400 leading-snug pt-[1px]"
    >
      {price.lowConfidence ? '~' : ''}£{price.priceMid.toFixed(2)}
    </span>
  );
}
