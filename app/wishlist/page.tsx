'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../../lib/supabaseClient';
import type { CardSearchResult } from '../trade/types';

type Priority = 'low' | 'medium' | 'high';

type WishlistRow = {
  id: string;
  card_id: string;
  set_id: string | null;
  card_name: string;
  card_number: string | null;
  image_url: string | null;
  set_name: string | null;
  quantity: number;
  priority: Priority;
  note: string | null;
};

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  medium: 'border-amber-300/30 bg-amber-400/10 text-amber-200',
  low: 'border-white/10 bg-white/5 text-stone-300',
};

export default function WishlistPage() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const [rows, setRows] = useState<WishlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('wishlist_cards')
      .select('id, card_id, set_id, card_name, card_number, image_url, set_name, quantity, priority, note')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(
        loadError.message.includes('wishlist_cards')
          ? 'The wishlist table is not set up yet.'
          : loadError.message
      );
    } else {
      setRows((data ?? []) as WishlistRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // Fetch-on-mount: load() sets loading state before it awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, load]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({ name: needle, pageSize: '12' });
        const response = await fetch(`/api/pokemon/search/cards?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Search failed');
        const json = (await response.json()) as { data?: CardSearchResult[] };
        setResults(json.data ?? []);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setResults([]);
        setSearchError('Card search failed. Try again in a moment.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const wanted = new Set(rows.map((row) => row.card_id));

  async function addCard(card: CardSearchResult) {
    if (!supabase || !user || wanted.has(card.id)) return;
    setBusyId(card.id);
    setError('');
    const { data, error: insertError } = await supabase
      .from('wishlist_cards')
      .insert({
        user_id: user.id,
        card_id: card.id,
        set_id: card.set?.id ?? null,
        card_name: card.name,
        card_number: card.number,
        image_url: card.images?.small ?? null,
        set_name: card.set?.name ?? null,
      })
      .select('id, card_id, set_id, card_name, card_number, image_url, set_name, quantity, priority, note')
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setRows((current) => [data as WishlistRow, ...current]);
    }
    setBusyId(null);
  }

  async function updateRow(id: string, patch: Partial<Pick<WishlistRow, 'quantity' | 'priority' | 'note'>>) {
    if (!supabase) return;
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    const { error: updateError } = await supabase.from('wishlist_cards').update(patch).eq('id', id);
    if (updateError) {
      setRows(previous);
      setError(updateError.message);
    }
  }

  async function removeRow(id: string) {
    if (!supabase) return;
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== id));
    const { error: deleteError } = await supabase.from('wishlist_cards').delete().eq('id', id);
    if (deleteError) {
      setRows(previous);
      setError(deleteError.message);
    }
  }

  const sorted = [...rows].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-300/80">Wishlist</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Cards you&apos;re hunting
            </h1>
            <p className="mt-2 text-sm text-stone-300">
              {rows.length} {rows.length === 1 ? 'card' : 'cards'} on your list. Traders can see what you want.
            </p>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {supabaseDisabled ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300">
            Supabase isn&apos;t configured, so the wishlist is unavailable.
          </div>
        ) : !authLoading && !user ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-6 text-center text-sm text-amber-200/80">
            Sign in to build your wishlist.
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <label htmlFor="wishlist-search" className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">
                Add a card
              </label>
              <input
                id="wishlist-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search any card, e.g. Charizard"
                className="mt-3 w-full rounded-xl border border-white/10 bg-stone-950/60 px-4 py-3 text-sm text-white placeholder:text-stone-500 focus:border-primary-400 focus:outline-none"
              />
              {searching ? <p className="mt-3 text-xs text-stone-400">Searching…</p> : null}
              {searchError ? <p className="mt-3 text-xs text-rose-300">{searchError}</p> : null}
              {results.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {results.map((card) => {
                    const already = wanted.has(card.id);
                    return (
                      <li key={card.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-center">
                        {card.images?.small ? (
                          <Image
                            src={card.images.small}
                            alt={card.name}
                            width={180}
                            height={250}
                            className="mx-auto h-auto w-full rounded-lg"
                          />
                        ) : null}
                        <p className="mt-2 truncate text-xs font-semibold text-white">{card.name}</p>
                        <p className="truncate text-[11px] text-stone-400">
                          {card.set?.name ?? 'Unknown set'} · #{card.number}
                        </p>
                        <button
                          type="button"
                          onClick={() => addCard(card)}
                          disabled={already || busyId === card.id}
                          className="mt-2 w-full rounded-lg bg-primary-400 px-2 py-1.5 text-xs font-semibold text-primary-950 hover:bg-primary-300 disabled:bg-stone-800 disabled:text-stone-400"
                        >
                          {already ? 'On your list' : busyId === card.id ? 'Adding…' : 'Add'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>

            <section className="mt-6">
              {loading ? (
                <p className="text-sm text-stone-400">Loading your list…</p>
              ) : sorted.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-10 text-center">
                  <div className="text-4xl">⭐</div>
                  <p className="mt-3 text-sm text-stone-300">
                    Nothing here yet. Search for a card above to start your list.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sorted.map((row) => (
                    <li
                      key={row.id}
                      className="flex gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="w-24 shrink-0">
                        {row.image_url ? (
                          <Image
                            src={row.image_url}
                            alt={row.card_name}
                            width={180}
                            height={250}
                            className="h-auto w-full rounded-lg"
                          />
                        ) : (
                          <div className="flex aspect-[5/7] items-center justify-center rounded-lg bg-stone-950/70 text-xs text-stone-500">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="truncate text-sm font-semibold text-white">{row.card_name}</p>
                          <p className="truncate text-xs text-stone-400">
                            {row.set_name ?? 'Unknown set'}
                            {row.card_number ? ` · #${row.card_number}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${PRIORITY_STYLE[row.priority]}`}>
                            {PRIORITY_LABEL[row.priority]}
                          </span>
                          <select
                            aria-label={`Priority for ${row.card_name}`}
                            value={row.priority}
                            onChange={(event) => updateRow(row.id, { priority: event.target.value as Priority })}
                            className="rounded-lg border border-white/10 bg-stone-950/60 px-2 py-1 text-xs text-stone-200"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-300">
                          <span>Qty</span>
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={row.quantity <= 1}
                            onClick={() => updateRow(row.id, { quantity: row.quantity - 1 })}
                            className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-white">{row.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={row.quantity >= 99}
                            onClick={() => updateRow(row.id, { quantity: row.quantity + 1 })}
                            className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <input
                          defaultValue={row.note ?? ''}
                          maxLength={200}
                          placeholder="Note (e.g. holo only)"
                          aria-label={`Note for ${row.card_name}`}
                          onBlur={(event) => {
                            const next = event.target.value.trim() || null;
                            if (next !== row.note) updateRow(row.id, { note: next });
                          }}
                          className="w-full rounded-lg border border-white/10 bg-stone-950/60 px-2 py-1.5 text-xs text-white placeholder:text-stone-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-xs text-stone-400 underline-offset-2 hover:text-rose-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
