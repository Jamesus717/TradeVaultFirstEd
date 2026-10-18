'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';
import type { UserCardRow } from '../binder/types';
import { fetchSetVariants } from '../../lib/setCardsCache';

export type OwnedSetSummary = {
  setId: string;
  setName: string;
  series: string;
  releaseDate: string;
  ownedCount: number;
  totalCards: number;
  completionPct: number;
  estimatedValue: number;
  logoUrl: string | null;
  symbolUrl: string | null;
};

export type GrailCard = {
  cardId: string;
  cardName: string;
  setName: string;
  setId: string;
  variant: string;
  imageUrl: string | null;
  estimatedValue: number;
};

export function useCollection() {
  const { user } = useAuth();
  const [ownedRows, setOwnedRows] = useState<UserCardRow[]>([]);
  const [setMeta, setSetMeta] = useState<
    Record<string, {
      name: string;
      series: string;
      total: number;
      releaseDate: string;
      logoUrl: string | null;
      symbolUrl: string | null;
    }>
  >({});
  const [setVariantTotals, setSetVariantTotals] = useState<Record<string, number>>({});
  const [cardPrices, setCardPrices] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all owned cards from Supabase
  useEffect(() => {
    async function load() {
      if (!user || !supabase) {
        setOwnedRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const { data, error: err } = await supabase
          .from('user_cards')
          .select('card_id, set_id, variant, owned')
          .eq('user_id', user.id)
          .eq('owned', true);

        if (err) throw new Error(err.message);
        setOwnedRows((data ?? []) as UserCardRow[]);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Failed to load collection'
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Fetch set metadata from the sets API (cached)
  useEffect(() => {
    async function loadSets() {
      try {
        const res = await fetch('/api/pokemon/sets');
        if (!res.ok) return;
        const json = await res.json();
        const sets = json.data ?? [];
        const meta: typeof setMeta = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const s of sets as any[]) {
          meta[s.id] = {
            name: s.name,
            series: s.series,
            total: s.total ?? s.printedTotal ?? 0,
            releaseDate: s.releaseDate ?? '',
            logoUrl: s.images?.logo ?? null,
            symbolUrl: s.images?.symbol ?? null,
          };
        }
        setSetMeta(meta);
      } catch {
        // silently fail — set names degrade gracefully
      }
    }
    loadSets();
  }, []);

  // Fetch true variant totals for sets we own cards in.
  // Goes through the shared set-cards cache, so the payload each expandable
  // set card needs is fetched and parsed once for the whole page rather than
  // once here and again per card.
  useEffect(() => {
    let active = true;

    async function loadVariantTotals() {
      const setIds = [...new Set(ownedRows.map((r) => r.set_id).filter((id): id is string => Boolean(id)))];
      if (setIds.length === 0) return;

      const totals: Record<string, number> = {};

      await Promise.all(
        setIds.map(async (setId) => {
          try {
            const variants = await fetchSetVariants(setId);
            totals[setId] = variants.length;
          } catch {
            // Ignore failure for individual sets
          }
        })
      );

      if (!active) return;

      setSetVariantTotals(prev => ({ ...prev, ...totals }));
    }
    loadVariantTotals();

    return () => {
      active = false;
    };
  }, [ownedRows]);

  // Fetch prices from the card_prices cache (reads only; the price route
  // fills it). Chunked so a large collection's `.in()` list stays well under
  // the URL length limit.
  useEffect(() => {
    let active = true;

    async function loadPrices() {
      if (!supabase || ownedRows.length === 0) return;

      const cardIds = [...new Set(
        ownedRows.map((r) => r.card_id).filter(Boolean)
      )];

      if (cardIds.length === 0) return;

      const chunkSize = 100;
      const prices: Record<string, number> = {};

      for (let i = 0; i < cardIds.length; i += chunkSize) {
        const chunk = cardIds.slice(i, i + chunkSize);
        const { data } = await supabase
          .from('card_prices')
          .select('card_id, price_mid')
          .in('card_id', chunk);

        for (const row of data ?? []) {
          if (row.card_id && row.price_mid) {
            prices[row.card_id] = Number(row.price_mid);
          }
        }
      }

      if (!active) return;

      setCardPrices(prices);
    }
    loadPrices();

    return () => {
      active = false;
    };
  }, [ownedRows]);

  // Derive set summaries
  const ownedSets = useMemo<OwnedSetSummary[]>(() => {
    const bySet = new Map<string, UserCardRow[]>();
    for (const row of ownedRows) {
      const sid = row.set_id ?? 'unknown';
      if (!bySet.has(sid)) bySet.set(sid, []);
      bySet.get(sid)!.push(row);
    }

    return [...bySet.entries()]
      .map(([setId, rows]) => {
        const meta = setMeta[setId];
        const ownedCount = rows.length;
        const totalCards = setVariantTotals[setId] ?? ((meta?.total ?? 0) * 2); // Fallback until fetched
        const completionPct = totalCards > 0
          ? Math.round((ownedCount / totalCards) * 100)
          : 0;
        const estimatedValue = rows.reduce((sum, row) => {
          const price = cardPrices[row.card_id] ?? 0;
          return sum + price;
        }, 0);

        return {
          setId,
          setName: meta?.name ?? setId,
          series: meta?.series ?? '',
          releaseDate: meta?.releaseDate ?? '',
          ownedCount,
          totalCards,
          completionPct,
          estimatedValue,
          logoUrl: meta?.logoUrl ?? null,
          symbolUrl: meta?.symbolUrl ?? null,
        };
      })
      .sort((a, b) => b.estimatedValue - a.estimatedValue);
  }, [cardPrices, ownedRows, setMeta, setVariantTotals]);

  // Total portfolio value
  const totalValue = useMemo(
    () => ownedSets.reduce((sum, s) => sum + s.estimatedValue, 0),
    [ownedSets]
  );

  // Total cards owned
  const totalCards = ownedRows.length;

  // Most valuable cards (grails)
  const grailCards = useMemo<GrailCard[]>(() => {
    return ownedRows
      .map((row) => {
        const price = cardPrices[row.card_id] ?? 0;
        const meta = setMeta[row.set_id ?? ''];
        return {
          cardId: row.card_id,
          cardName: row.card_id, // name resolved later via API
          setName: meta?.name ?? row.set_id ?? 'Unknown',
          setId: row.set_id ?? '',
          variant: row.variant ?? 'Normal',
          imageUrl: null,
          estimatedValue: price,
        };
      })
      .filter((c) => c.estimatedValue > 0)
      .sort((a, b) => b.estimatedValue - a.estimatedValue)
      .slice(0, 6);
  }, [cardPrices, ownedRows, setMeta]);

  // Incomplete sets (started but not 100%)
  const incompleteSets = useMemo(
    () => ownedSets.filter(
      (s) => s.completionPct > 0 && s.completionPct < 100
    ).sort((a, b) => b.completionPct - a.completionPct),
    [ownedSets]
  );

  return {
    user,
    loading,
    error,
    ownedRows,
    ownedSets,
    totalValue,
    totalCards,
    grailCards,
    incompleteSets,
    setMeta,
    cardPrices,
  };
}