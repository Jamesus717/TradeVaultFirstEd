'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

type CustomBinderRow = {
  id: string;
  user_id: string;
  name: string;
};

type CustomBinderCardRow = {
  id: string;
  binder_id: string;
  card_id: string;
  set_id: string | null;
  card_name: string | null;
  card_number: string | null;
  image_url: string | null;
};

type SearchCard = {
  id: string;
  name: string;
  number: string;
  set?: { id: string; name: string; series: string };
  images?: { small?: string };
};

type SearchResponse = { data?: SearchCard[] };

export function useCustomBinder() {
  const { user, supabaseDisabled } = useAuth();
  const [binder, setBinder] = useState<CustomBinderRow | null>(null);
  const [binderCards, setBinderCards] = useState<CustomBinderCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [binderNameDraft, setBinderNameDraft] = useState('');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [searching, setSearching] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  const canUse = Boolean(user && !supabaseDisabled && supabase);

  useEffect(() => {
    async function loadBinder() {
      if (!user) {
        setBinder(null);
        setBinderCards([]);
        setBinderNameDraft('');
        setLoading(false);
        return;
      }

      if (supabaseDisabled || !supabase) {
        setError('Supabase environment variables are missing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const { data: existing, error: binderError } = await supabase
        .from('custom_binders')
        .select('id, user_id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (binderError) {
        setError(binderError.message);
        setLoading(false);
        return;
      }

      let nextBinder = (existing ?? null) as CustomBinderRow | null;

      if (!nextBinder) {
        const { data: created, error: createError } = await supabase
          .from('custom_binders')
          .insert({ user_id: user.id, name: 'My Binder' })
          .select('id, user_id, name')
          .single();

        if (createError) {
          setError(createError.message);
          setLoading(false);
          return;
        }

        nextBinder = created as unknown as CustomBinderRow;
      }

      setBinder(nextBinder);
      setBinderNameDraft(nextBinder.name);

      const { data: cards, error: cardsError } = await supabase
        .from('custom_binder_cards')
        .select('id, binder_id, card_id, set_id, card_name, card_number, image_url')
        .eq('binder_id', nextBinder.id)
        .order('created_at', { ascending: false });

      if (cardsError) {
        setError(cardsError.message);
        setBinderCards([]);
        setLoading(false);
        return;
      }

      setBinderCards((cards ?? []) as CustomBinderCardRow[]);
      setLoading(false);
    }

    loadBinder();
  }, [supabaseDisabled, user]);

  useEffect(() => {
    async function search() {
      if (!canUse) {
        setSearchResults([]);
        return;
      }

      const trimmed = query.trim();

      if (trimmed.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      setError('');

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }

      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const response = await fetch(
          `/api/pokemon/search/cards?name=${encodeURIComponent(trimmed)}&pageSize=20`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Search failed.');
        }

        const json = (await response.json()) as SearchResponse;
        setSearchResults((json.data ?? []) as SearchCard[]);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }

        setError(cause instanceof Error ? cause.message : 'Search failed.');
      } finally {
        setSearching(false);
      }
    }

    const handle = setTimeout(search, 300);
    return () => clearTimeout(handle);
  }, [canUse, query]);

  const binderCardIds = useMemo(() => new Set(binderCards.map((row) => row.card_id)), [binderCards]);

  async function saveBinderName() {
    if (!binder || !canUse) {
      return;
    }

    if (!supabase) {
      return;
    }

    const nextName = binderNameDraft.trim();

    if (!nextName) {
      setBinderNameDraft(binder.name);
      return;
    }

    if (nextName === binder.name) {
      return;
    }

    setSaving(true);
    setError('');

    const { data, error: updateError } = await supabase
      .from('custom_binders')
      .update({ name: nextName })
      .eq('id', binder.id)
      .select('id, user_id, name')
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setBinder(data as unknown as CustomBinderRow);
    setSaving(false);
  }

  async function addCard(card: SearchCard) {
    if (!binder || !canUse) {
      return;
    }

    if (!supabase) {
      return;
    }

    if (binderCardIds.has(card.id)) {
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      binder_id: binder.id,
      card_id: card.id,
      set_id: card.set?.id ?? null,
      card_name: card.name,
      card_number: card.number,
      image_url: card.images?.small ?? null,
    };

    const { data, error: insertError } = await supabase
      .from('custom_binder_cards')
      .insert(payload)
      .select('id, binder_id, card_id, set_id, card_name, card_number, image_url')
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setBinderCards((current) => [data as unknown as CustomBinderCardRow, ...current]);
    setSaving(false);
  }

  async function removeCard(cardId: string) {
    if (!binder || !canUse) {
      return;
    }

    if (!supabase) {
      return;
    }

    setSaving(true);
    setError('');

    const existing = binderCards.find((row) => row.card_id === cardId);

    if (!existing) {
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('custom_binder_cards')
      .delete()
      .eq('id', existing.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setBinderCards((current) => current.filter((row) => row.id !== existing.id));
    setSaving(false);
  }

  return {
    user,
    canUse,
    loading,
    saving,
    error,
    binder,
    binderNameDraft,
    setBinderNameDraft,
    saveBinderName,
    query,
    setQuery,
    searching,
    searchResults,
    binderCards,
    addCard,
    removeCard,
    binderCardIds,
  };
}
