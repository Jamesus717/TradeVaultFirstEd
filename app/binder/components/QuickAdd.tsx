'use client';

import Image from 'next/image';
import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useCardSearch } from '../../trade/hooks/useCardSearch';
import type { CardSearchResult } from '../../trade/types';

const NO_OWNED_CARDS = new Set<string>();

// Add a card from anywhere in the binder without finding its set first: built
// for logging a pull or a want from a phone at a shop.
export function QuickAdd() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [card, setCard] = useState<CardSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const { results, loading, error } = useCardSearch({
    enabled: open,
    query,
    mode: 'all',
    ownedCardIdSet: NO_OWNED_CARDS,
    selectedCard: card,
  });

  function close() {
    setOpen(false);
    setCard(null);
    setQuery('');
    setMessage('');
    setFailed(false);
  }

  async function save(target: 'owned' | 'wanted') {
    if (!card || !user || !supabase) {
      return;
    }

    setSaving(true);
    setFailed(false);
    const { error: saveError } =
      target === 'owned'
        ? await supabase.from('user_cards').upsert(
            { user_id: user.id, card_id: card.id, set_id: card.set?.id ?? null, variant: 'Normal', owned: true },
            { onConflict: 'user_id,card_id,variant,set_id' }
          )
        : await supabase.from('wishlist_cards').insert({
            user_id: user.id,
            card_id: card.id,
            set_id: card.set?.id ?? null,
            card_name: card.name,
            card_number: card.number,
            image_url: card.images?.small ?? null,
            set_name: card.set?.name ?? null,
          });
    setSaving(false);

    if (saveError) {
      setFailed(true);
      setMessage(saveError.code === '23505' ? `${card.name} is already on your wishlist.` : saveError.message);
      return;
    }

    setMessage(target === 'owned' ? `Added ${card.name} to your binder.` : `Added ${card.name} to your wishlist.`);
    setCard(null);
    setQuery('');
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 min-h-12 rounded-full bg-primary-400 px-5 text-sm font-semibold text-primary-950 shadow-lg hover:bg-primary-300 sm:bottom-6"
      >
        Quick add
      </button>

      {open ? (
        <div className="sheet-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-label="Quick add" className="sheet max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-stone-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Quick add</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-stone-200 hover:bg-white/[0.06]"
              >
                ×
              </button>
            </div>

            {card ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-stone-200">
                  {card.name}, {card.set?.name} {card.number}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save('owned')}
                    className="min-h-11 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:opacity-60"
                  >
                    I own this
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save('wanted')}
                    className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm text-stone-100 hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    I want this
                  </button>
                </div>
                <button type="button" onClick={() => setCard(null)} className="text-sm text-stone-400 hover:text-white">
                  Pick a different card
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Card name"
                  aria-label="Card name"
                  className="mt-4 w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-base text-white outline-none focus:border-primary-300/50"
                />
                <p className="mt-2 text-sm text-stone-400">
                  {loading ? 'Searching...' : error || (query.trim().length >= 2 && results.length === 0 ? 'No cards match that name.' : '')}
                </p>
                <ul className="mt-2 space-y-1">
                  {results.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => setCard(result)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06]"
                      >
                        {result.images?.small ? (
                          <Image src={result.images.small} alt="" width={36} height={50} className="rounded" unoptimized />
                        ) : null}
                        <span className="min-w-0 truncate text-sm text-stone-100">
                          {result.name}, {result.set?.name} {result.number}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {message ? (
              <p role={failed ? 'alert' : 'status'} className={`mt-3 text-sm ${failed ? 'text-rose-200' : 'text-primary-200'}`}>
                {message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
