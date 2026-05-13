'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
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
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-10 text-center text-stone-300">
        No cards match that search.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {cards.map((card) => {
        const isOwned = Boolean(owned[card.id]);
        const isSaving = savingId === card.id;

        return (
          <article
            key={card.id}
            onClick={() => onCardClick(card)}
            className={`group cursor-pointer overflow-hidden rounded-[1.5rem] border transition-all duration-200 ${
              isOwned
                ? 'border-primary-400/40 bg-primary-500/10 shadow-lg shadow-primary-950/30'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
            }`}
          >
            <div className="p-3">
              <div className="overflow-hidden rounded-[1rem] bg-stone-950/80 ring-1 ring-white/5">
                {card.image ? (
                  <Image
                    src={card.image}
                    alt={`${card.name} ${card.variant}`}
                    width={245}
                    height={342}
                    sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
                    className="h-auto w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[5/7] items-center justify-center text-sm text-stone-500">
                    No image
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-400">
                  #{card.number}
                </p>
                <div className="flex items-start justify-between gap-1">
                  <h2 className="line-clamp-2 text-sm font-semibold text-white leading-snug">
                    {card.name}
                  </h2>
                  <CardPriceBadge card={card} isOwned={isOwned} />
                </div>
                <p className="text-xs text-stone-300">{card.variant}</p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOwned(card);
                }}
                disabled={!canEdit || isSaving || bulkSaving}
                className={`mt-3 w-full rounded-[0.9rem] px-3 py-2 text-xs font-medium transition-colors ${
                  isOwned
                    ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                    : 'bg-stone-800 text-stone-100 hover:bg-stone-700'
                } ${!canEdit || isSaving || bulkSaving ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {isSaving ? 'Saving...' : isOwned ? 'Owned' : 'Mark as Owned'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

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
