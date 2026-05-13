'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';
import type { UserCardRow } from '../binder/types';
import { buildVariants } from '../binder/utils';

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

  // Fetch true variant totals for sets we own cards in
  useEffect(() => {
    async function loadVariantTotals() {
      const setIds = [...new Set(ownedRows.map((r) => r.set_id).filter((id): id is string => Boolean(id)))];
      if (setIds.length === 0) return;

      const totals: Record<string, number> = {};

      await Promise.all(
        setIds.map(async (setId) => {
          try {
            const res = await fetch(`/api/pokemon/cards?setId=${encodeURIComponent(setId)}&pageSize=250`);
            if (!res.ok) return;
            const json = await res.json();
            const cards = json.data ?? [];
            const variants = buildVariants(cards);
            totals[setId] = variants.length;
          } catch {
            // Ignore failure for individual sets
          }
        })
      );

      setSetVariantTotals(prev => ({ ...prev, ...totals }));
    }
    loadVariantTotals();
  }, [ownedRows]);

  // Fetch prices from Supabase card_prices cache
  // (reads cached prices only — does NOT call eBay)
  useEffect(() => {
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

      setCardPrices(prices);
    }
    loadPrices();
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

  // Sparkline data for portfolio value chart
  // Uses fetched_at from card_prices to build
  // approximate historical snapshots
  const [sparklineData, setSparklineData] = useState<
    { date: string; value: number }[]
  >([]);

  useEffect(() => {
    async function loadSparkline() {
      if (!supabase || ownedRows.length === 0) return;

      const cardIds = [...new Set(
        ownedRows.map((r) => r.card_id).filter(Boolean)
      )];
      if (cardIds.length === 0) return;

      const { data } = await supabase
        .from('card_prices')
        .select('card_id, price_mid, fetched_at')
        .in('card_id', cardIds)
        .order('fetched_at', { ascending: true });

      if (!data || data.length === 0) {
        // No historical data yet — generate flat mock line
        const today = new Date();
        const points = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (6 - i));
          return {
            date: d.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short'
            }),
            value: totalValue,
          };
        });
        setSparklineData(points);
        return;
      }

      // Group by day and sum prices
      const byDay = new Map<string, number>();
      for (const row of data) {
        const day = row.fetched_at.split('T')[0];
        const current = byDay.get(day) ?? 0;
        byDay.set(day, current + Number(row.price_mid ?? 0));
      }

      const points = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateStr, value]) => ({
          date: new Date(dateStr).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          }),
          value: Math.round(value * 100) / 100,
        }));

      setSparklineData(points);
    }
    loadSparkline();
  }, [ownedRows, totalValue]);

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
    sparklineData,
    setMeta,
    cardPrices,
  };
}