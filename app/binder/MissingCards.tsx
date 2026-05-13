'use client';

import type { CardVariant } from './types';

type Props = {
  missingCards: CardVariant[];
  selectedSetName: string;
};

export function MissingCards({ missingCards, selectedSetName }: Props) {
  return (
    <section className="space-y-4">
      <div className="rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/75">
          Missing Cards
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {missingCards.length} still needed in {selectedSetName}
        </h2>
        <p className="mt-1 text-sm text-stone-400">
          This want list is automatically derived from the selected set minus your owned
          variants.
        </p>
      </div>

      {missingCards.length === 0 ? (
        <div className="rounded-[1.5rem] border border-primary-300/20 bg-primary-400/10 p-6 text-sm text-primary-50">
          Complete set for the currently loaded variants.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {missingCards.map((card) => (
            <article
              key={`missing-${card.id}`}
              className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4"
            >
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-stone-400">
                #{card.number}
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">{card.name}</h3>
              <p className="mt-1 text-sm text-stone-300">{card.variant}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

