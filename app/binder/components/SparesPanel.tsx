'use client';

import { useState } from 'react';
import { demoMode } from '../../../lib/demo';
import { getBinderRows, useBinderDetails } from '../../../lib/binderDetails';
import { findSpares, groupSparesBySet, sparesToTextItems } from '../../../lib/spares';
import { CopyAsText } from '../../components/CopyAsText';

// Cards with qty > 1, grouped by set. Quantity is only stored in demo mode
// today, so real accounts see an honest "no quantities yet" note.
export function SparesPanel() {
  const [open, setOpen] = useState(false);
  useBinderDetails(); // re-render when demo rows change
  const items = findSpares(getBinderRows());
  const groups = groupSparesBySet(items);
  const total = items.reduce((n, i) => n + i.spares, 0);

  return (
    <div className="panel p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-11 text-left text-sm font-semibold text-primary-200"
      >
        Spares to trade ({total}) {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-3 space-y-4 text-sm text-stone-300">
          {items.length === 0 ? (
            <p>
              {demoMode
                ? 'No spares yet. A card shows here when you own more than one copy.'
                : 'No spares to show. Your binder does not store quantities yet, so only cards with more than one copy appear here once it does.'}
            </p>
          ) : (
            <>
              <p>One copy of each card is kept. Spares are the extras.</p>
              {groups.map((g) => (
                <section key={g.setName} aria-label={g.setName}>
                  <h3 className="font-semibold text-white">
                    {g.setName} <span className="text-stone-400">({g.total})</span>
                  </h3>
                  <ul className="mt-1 space-y-1">
                    {g.items.map((i) => (
                      <li key={i.cardId} className="flex justify-between gap-3">
                        <span>{i.name}</span>
                        <span className="text-stone-400">x{i.spares}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <CopyAsText
                title="Spares"
                emptyMessage="You have no spares, so there is nothing to copy."
                getItems={() => sparesToTextItems(findSpares(getBinderRows()))}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
