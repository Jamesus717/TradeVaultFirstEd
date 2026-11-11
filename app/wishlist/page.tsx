'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../auth';
import { supabase } from '../../lib/supabaseClient';
import type { CardSearchResult } from '../trade/types';
import { DEMO_WISHLIST, demoEmpty, demoMode, demoPrices } from '../../lib/demo';
import { findUnderTarget, formatGbp, parseTargetPrice, type CachedPrice } from '../../lib/priceAlerts';
import { fetchCachedPrices, missingTargetColumn } from '../../lib/priceAlertsData';
import { PriceAlerts } from './PriceAlerts';
import { WantsCsv } from './WantsCsv';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { exportScope } from '../../lib/exportCsv';
import { WantsFiltersBar } from './WantsFilters';
import {
  DEFAULT_WANT_SORT,
  EMPTY_WANT_FILTERS,
  activeWantFilterCount,
  applyWantFilters,
  hasAddedDates,
  parseWantFilters,
  parseWantSort,
  serializeWantFilters,
  sortWants,
  wantSets,
  type WantFilters,
  type WantSort,
} from '../../lib/wantsFilters';
import { CopyAsText } from '../components/CopyAsText';
import { gotIt, undoGotIt, type GotItReceipt } from '../../lib/gotIt';
import { mergeWants } from '../../lib/wantsCsv';
import type { WantValue } from '../../lib/wantsCsv';

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
  created_at?: string | null;
  // Absent when the 023 proposal (target prices) is not applied.
  target_price?: number | string | null;
};

const BASE_COLUMNS = 'id, card_id, set_id, card_name, card_number, image_url, set_name, quantity, priority, note, created_at';

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
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
  const [prices, setPrices] = useState<CachedPrice[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [targetsReady, setTargetsReady] = useState(true);
  const [targetErrors, setTargetErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; receipt: GotItReceipt } | null>(null);
  const [toastNote, setToastNote] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<WantFilters>(EMPTY_WANT_FILTERS);
  const [sortMode, setSortMode] = useState<WantSort>(DEFAULT_WANT_SORT);
  const [urlReady, setUrlReady] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (demoMode) {
      const now = Date.now();
      setRows(demoEmpty ? [] : DEMO_WISHLIST);
      setPrices(demoPrices(now));
      setNowMs(now);
      setLoading(false);
      return;
    }
    if (!supabase || !user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const client = supabase;
    const read = (columns: string) =>
      client.from('wishlist_cards').select(columns).eq('user_id', user.id).order('created_at', { ascending: false });
    let { data, error: loadError } = await read(`${BASE_COLUMNS}, target_price`);
    // Target prices need the 023 proposal; without it the list still works.
    const hasTargets = !missingTargetColumn(loadError);
    if (!hasTargets) ({ data, error: loadError } = await read(BASE_COLUMNS));
    setTargetsReady(hasTargets);

    if (loadError) {
      setError(
        loadError.message.includes('wishlist_cards')
          ? 'The wishlist table is not set up yet.'
          : loadError.message
      );
    } else {
      const loaded = (data ?? []) as unknown as WishlistRow[];
      setRows(loaded);
      setPrices(await fetchCachedPrices(client, loaded.map((row) => row.card_id)));
      setNowMs(Date.now());
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

  // Read filters from the URL once, after mount (avoids a hydration mismatch).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const timer = setTimeout(() => {
      setFilters(parseWantFilters(params));
      setSortMode(parseWantSort(params));
      setUrlReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Keep the URL in step, without piling up history entries.
  useEffect(() => {
    if (!urlReady) return;
    const query = serializeWantFilters(filters, sortMode);
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [urlReady, filters, sortMode]);

  const wanted = new Set(rows.map((row) => row.card_id));

  function importedWants(added: WantValue[]) {
    // Real mode saved to the database: reload. Demo keeps the rows in memory.
    if (!demoMode) {
      void load();
      return;
    }
    const fresh: WishlistRow[] = added.map((v) => ({
      id: `demo-csv-${v.cardId}`,
      card_id: v.cardId,
      set_id: v.setId,
      card_name: v.cardName,
      card_number: v.cardNumber,
      image_url: `https://images.pokemontcg.io/${v.setId}/${v.cardNumber}.png`,
      set_name: v.setName,
      quantity: v.qty,
      priority: v.priority,
      note: v.note,
      target_price: null,
    }));
    setRows((current) => mergeWants(current, fresh));
  }

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
      .select(BASE_COLUMNS)
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setRows((current) => [data as WishlistRow, ...current]);
    }
    setBusyId(null);
  }

  async function updateRow(
    id: string,
    patch: Partial<Pick<WishlistRow, 'quantity' | 'priority' | 'note' | 'target_price'>>
  ) {
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    if (demoMode || !supabase) return;
    const { error: updateError } = await supabase.from('wishlist_cards').update(patch).eq('id', id);
    if (updateError) {
      setRows(previous);
      setError(updateError.message);
    }
  }

  function saveTarget(row: WishlistRow, input: string) {
    const parsed = parseTargetPrice(input);
    setTargetErrors((current) => {
      const next = { ...current };
      if (parsed.ok) delete next[row.id];
      else next[row.id] = parsed.error;
      return next;
    });
    if (!parsed.ok) return;
    const currentValue = row.target_price === null || row.target_price === undefined ? null : Number(row.target_price);
    if (parsed.value !== currentValue) updateRow(row.id, { target_price: parsed.value });
  }

  async function removeRow(id: string) {
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== id));
    if (demoMode || !supabase) return;
    const { error: deleteError } = await supabase.from('wishlist_cards').delete().eq('id', id);
    if (deleteError) {
      setRows(previous);
      setError(deleteError.message);
    }
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  async function markGotIt(row: WishlistRow) {
    if (movingId) return;
    setMovingId(row.id);
    setError('');
    let receipt: GotItReceipt = { want: row, variant: 'Normal', prior: 'none' };
    if (!demoMode) {
      if (!supabase || !user) {
        setMovingId(null);
        return;
      }
      const result = await gotIt(supabase, user.id, row);
      if (!result.ok) {
        setError(`Couldn't move ${row.card_name} to your binder, so it's still on your list. ${result.message}`);
        setMovingId(null);
        return;
      }
      receipt = result.receipt;
    }
    setRows((current) => current.filter((r) => r.id !== row.id));
    setMovingId(null);
    setToastNote('');
    setToast({ message: `${row.card_name} moved to your binder.`, receipt });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }

  async function undoMove() {
    if (!toast) return;
    const { receipt } = toast;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (!demoMode) {
      if (!supabase || !user) return;
      const result = await undoGotIt(supabase, user.id, receipt);
      if (!result.ok) {
        setToastNote(`Couldn't undo: ${result.message}`);
        toastTimer.current = setTimeout(() => setToast(null), 8000);
        return;
      }
    }
    setRows((current) => (current.some((r) => r.id === receipt.want.id) ? current : [...current, receipt.want as WishlistRow]));
    setToast(null);
  }

  const sorted = useMemo(
    () => sortWants(applyWantFilters(rows, filters), sortMode),
    [rows, filters, sortMode]
  );
  const filterCount = activeWantFilterCount(filters);
  const sets = useMemo(() => wantSets(rows), [rows]);
  const showAdded = useMemo(() => hasAddedDates(rows), [rows]);
  const priceByCard = new Map(prices.map((price) => [price.card_id, price]));
  const alerts = targetsReady
    ? findUnderTarget(
        rows.map((row) => ({ ...row, target_price: row.target_price ?? null })),
        prices,
        { nowMs }
      )
    : [];
  const alerted = new Set(alerts.map((alert) => alert.wishlistId));

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="hero-panel">
          <div className="p-6 sm:p-8">
            <p className="eyebrow">Wishlist</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Cards you&apos;re hunting
            </h1>
            <p className="mt-2 text-sm text-stone-300">
              {rows.length} {rows.length === 1 ? 'card' : 'cards'} on your list. Traders can see what you want.
            </p>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {demoMode ? (
          <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3 text-xs text-amber-200/80">
            Example wishlist and example prices. Nothing here is saved.
          </p>
        ) : null}

        {!demoMode && supabaseDisabled ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300">
            Supabase isn&apos;t configured, so the wishlist is unavailable.
          </div>
        ) : !demoMode && !authLoading && !user ? (
          <div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-400/5 p-6 text-center text-sm text-amber-200/80">
            Sign in to build your wishlist.
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <label htmlFor="wishlist-search" className="text-xs font-semibold text-stone-400">
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
                        <p className="truncate text-2xs text-stone-400">
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

            <section className="panel mt-6 p-5">
              <CopyAsText
                title="Wants"
                emptyMessage="Your wishlist is empty, so there is nothing to copy."
                getItems={() =>
                  rows.map((r) => ({ name: r.card_name, setName: r.set_name ?? r.set_id, qty: r.quantity, priority: r.priority }))
                }
              />
            </section>

            <section className="panel mt-6 p-5">
              <ExportCsvButton
                filename="tradevault-wishlist.csv"
                emptyMessage="Nothing to export. Your wishlist is empty or no cards match your filters."
                scope={`${exportScope('wishlist cards', sorted.length, rows.length, filterCount)} Price is your target price, if set.`}
                rows={sorted.map((r) => ({
                  card: r.card_name,
                  set: r.set_name ?? r.set_id ?? '',
                  number: r.card_number,
                  condition: null,
                  qty: r.quantity,
                  price: r.target_price == null || r.target_price === '' ? null : Number(r.target_price),
                }))}
              />
            </section>

            <WantsCsv rows={rows} onImported={importedWants} />

            {alerts.length > 0 ? (
              <div className="mt-6">
                <PriceAlerts alerts={alerts} example={demoMode} />
              </div>
            ) : null}

            {rows.length > 0 ? (
              <section className="panel mt-6 p-5">
                <WantsFiltersBar
                  filters={filters}
                  sort={sortMode}
                  sets={sets}
                  showAdded={showAdded}
                  activeCount={filterCount}
                  onFilters={setFilters}
                  onSort={setSortMode}
                  onClear={() => setFilters(EMPTY_WANT_FILTERS)}
                />
                <p className="mt-3 text-xs text-stone-400" aria-live="polite">
                  {filterCount > 0
                    ? `Showing ${sorted.length} of ${rows.length} cards.`
                    : `${rows.length} ${rows.length === 1 ? 'card' : 'cards'}.`}
                </p>
              </section>
            ) : null}

            <section className="mt-6">
              {loading ? (
                <p className="text-sm text-stone-400">Loading your list…</p>
              ) : rows.length > 0 && sorted.length === 0 ? (
                <EmptyState
                  compact
                  title="No cards match"
                  body="Nothing on your wishlist matches these filters."
                  action={{ label: 'Clear all filters', onClick: () => setFilters(EMPTY_WANT_FILTERS) }}
                />
              ) : sorted.length === 0 ? (
                <EmptyState
                  compact
                  title="Your wishlist is empty"
                  body="Search for a card above to add it. Traders can see your list, and the Trade Board flags listings that match it."
                />
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sorted.map((row) => (
                    <li
                      key={row.id}
                      className="panel flex gap-4 p-4"
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
                          <span className={`rounded-full border px-2 py-0.5 text-2xs ${PRIORITY_STYLE[row.priority]}`}>
                            {PRIORITY_LABEL[row.priority]}
                          </span>
                          <select
                            aria-label={`Priority for ${row.card_name}`}
                            value={row.priority}
                            onChange={(event) => updateRow(row.id, { priority: event.target.value as Priority })}
                            className="min-h-11 rounded-lg border border-white/10 bg-stone-950/60 px-2 py-1 text-xs text-stone-200"
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
                            className="h-11 w-11 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-white">{row.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={row.quantity >= 99}
                            onClick={() => updateRow(row.id, { quantity: row.quantity + 1 })}
                            className="h-11 w-11 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <PriceLine
                          price={priceByCard.get(row.card_id)}
                          under={alerted.has(row.id)}
                          example={demoMode}
                        />
                        {targetsReady ? (
                          <div>
                            <label className="flex items-center gap-2 text-xs text-stone-300">
                              <span className="shrink-0">Alert under £</span>
                              <input
                                defaultValue={
                                  row.target_price === null || row.target_price === undefined
                                    ? ''
                                    : Number(row.target_price).toFixed(2)
                                }
                                inputMode="decimal"
                                placeholder="e.g. 12.50"
                                aria-label={`Target price for ${row.card_name}`}
                                aria-invalid={targetErrors[row.id] ? true : undefined}
                                onBlur={(event) => saveTarget(row, event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') event.currentTarget.blur();
                                }}
                                className="min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-stone-950/60 px-2 text-sm text-white placeholder:text-stone-500"
                              />
                            </label>
                            {targetErrors[row.id] ? (
                              <p className="mt-1 text-2xs text-rose-300">{targetErrors[row.id]}</p>
                            ) : null}
                          </div>
                        ) : null}
                        <input
                          defaultValue={row.note ?? ''}
                          maxLength={200}
                          placeholder="Note (e.g. holo only)"
                          aria-label={`Note for ${row.card_name}`}
                          onBlur={(event) => {
                            const next = event.target.value.trim() || null;
                            if (next !== row.note) updateRow(row.id, { note: next });
                          }}
                          className="min-h-11 w-full rounded-lg border border-white/10 bg-stone-950/60 px-2 py-1.5 text-xs text-white placeholder:text-stone-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="min-h-11 self-start pr-4 text-xs text-stone-400 underline-offset-2 hover:text-rose-300 hover:underline"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => markGotIt(row)}
                          disabled={movingId === row.id}
                          className="min-h-11 w-full rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-60"
                        >
                          {movingId === row.id ? 'Moving…' : 'Got it'}
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
      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-white/10 bg-stone-900 p-3 text-sm text-white shadow-lg"
        >
          <span>{toastNote || toast.message}</span>
          <button
            type="button"
            onClick={undoMove}
            className="min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-primary-300 hover:bg-white/10"
          >
            Undo
          </button>
        </div>
      ) : null}
    </main>
  );
}

function PriceLine({ price, under, example }: { price?: CachedPrice; under: boolean; example: boolean }) {
  const amount = price?.price_mid === null || price?.price_mid === undefined ? null : Number(price.price_mid);
  if (amount === null || !Number.isFinite(amount) || (price?.currency ?? 'GBP') !== 'GBP') {
    return <p className="text-xs text-stone-500">No market price yet</p>;
  }
  return (
    <p className="text-xs text-stone-300">
      Market <span className={under ? 'font-semibold text-emerald-300' : 'text-white'}>{formatGbp(amount)}</span>
      {example ? <span className="text-stone-500"> (example)</span> : null}
      {under ? <span className="text-emerald-300"> · under target</span> : null}
    </p>
  );
}
