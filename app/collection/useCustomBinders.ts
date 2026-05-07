'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

export type CustomBinder = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type CustomBinderCard = {
  id: string;
  binder_id: string;
  card_id: string;
  set_id: string | null;
  card_name: string | null;
  card_number: string | null;
  image_url: string | null;
  created_at: string;
};

type AddCardPayload = {
  card_id: string;
  set_id: string | null;
  card_name: string;
  card_number: string;
  image_url: string | null;
};

export function useCustomBinders() {
  const { user, supabaseDisabled } = useAuth();
  const canUse = Boolean(user && !supabaseDisabled && supabase);
  const [binders, setBinders] = useState<CustomBinder[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null);
  const [binderCards, setBinderCards] = useState<CustomBinderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedBinder = useMemo(
    () => binders.find((binder) => binder.id === selectedBinderId) ?? null,
    [binders, selectedBinderId]
  );

  useEffect(() => {
    async function loadBinders() {
      if (!user) {
        setBinders([]);
        setSelectedBinderId(null);
        setBinderCards([]);
        setLoading(false);
        setError('');
        return;
      }

      if (supabaseDisabled || !supabase) {
        setBinders([]);
        setSelectedBinderId(null);
        setBinderCards([]);
        setLoading(false);
        setError('Supabase environment variables are missing.');
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('custom_binders')
        .select('id, user_id, name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setBinders([]);
        setSelectedBinderId(null);
        setBinderCards([]);
        setLoading(false);
        return;
      }

      const nextBinders = (data ?? []) as CustomBinder[];
      setBinders(nextBinders);
      setSelectedBinderId((current) => current ?? nextBinders[0]?.id ?? null);
      setLoading(false);
    }

    loadBinders();
  }, [supabaseDisabled, user]);

  useEffect(() => {
    async function loadCards() {
      if (!selectedBinderId || !canUse) {
        setBinderCards([]);
        setCardsLoading(false);
        return;
      }

      if (!supabase) {
        setBinderCards([]);
        setCardsLoading(false);
        return;
      }

      setCardsLoading(true);
      const { data, error: cardsError } = await supabase
        .from('custom_binder_cards')
        .select('id, binder_id, card_id, set_id, card_name, card_number, image_url, created_at')
        .eq('binder_id', selectedBinderId)
        .order('created_at', { ascending: false });

      if (cardsError) {
        setError(cardsError.message);
        setBinderCards([]);
        setCardsLoading(false);
        return;
      }

      setBinderCards((data ?? []) as CustomBinderCard[]);
      setCardsLoading(false);
    }

    loadCards();
  }, [canUse, selectedBinderId]);

  async function createBinder(name: string) {
    if (!canUse || !user || !supabase) {
      return null;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('custom_binders')
      .insert({ user_id: user.id, name: trimmed })
      .select('id, user_id, name, created_at')
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return null;
    }

    const created = data as unknown as CustomBinder;
    setBinders((current) => [...current, created]);
    setSelectedBinderId(created.id);
    setSaving(false);
    return created;
  }

  async function renameBinder(binderId: string, name: string) {
    if (!canUse || !supabase) {
      return false;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      return false;
    }

    setSaving(true);
    setError('');

    const { data, error: updateError } = await supabase
      .from('custom_binders')
      .update({ name: trimmed })
      .eq('id', binderId)
      .select('id, user_id, name, created_at')
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    const updated = data as unknown as CustomBinder;
    setBinders((current) => current.map((binder) => (binder.id === binderId ? updated : binder)));
    setSaving(false);
    return true;
  }

  async function deleteBinder(binderId: string) {
    if (!canUse || !supabase) {
      return false;
    }

    setSaving(true);
    setError('');

    const { error: deleteError } = await supabase.from('custom_binders').delete().eq('id', binderId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return false;
    }

    setBinders((current) => current.filter((binder) => binder.id !== binderId));
    if (selectedBinderId === binderId) {
      setSelectedBinderId(null);
      setBinderCards([]);
    }
    setSaving(false);
    return true;
  }

  async function addCardToBinder(binderId: string, payload: AddCardPayload) {
    if (!canUse || !supabase) {
      return null;
    }

    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('custom_binder_cards')
      .insert({
        binder_id: binderId,
        card_id: payload.card_id,
        set_id: payload.set_id,
        card_name: payload.card_name,
        card_number: payload.card_number,
        image_url: payload.image_url,
      })
      .select('id, binder_id, card_id, set_id, card_name, card_number, image_url, created_at')
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return null;
    }

    const created = data as unknown as CustomBinderCard;
    setBinderCards((current) => (created.binder_id === selectedBinderId ? [created, ...current] : current));
    setSaving(false);
    return created;
  }

  async function removeCardFromBinder(rowId: string) {
    if (!canUse || !supabase) {
      return false;
    }

    setSaving(true);
    setError('');

    const { error: deleteError } = await supabase.from('custom_binder_cards').delete().eq('id', rowId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return false;
    }

    setBinderCards((current) => current.filter((row) => row.id !== rowId));
    setSaving(false);
    return true;
  }

  const binderCardIds = useMemo(() => new Set(binderCards.map((row) => row.card_id)), [binderCards]);

  return {
    user,
    canUse,
    loading,
    cardsLoading,
    saving,
    error,
    binders,
    selectedBinderId,
    setSelectedBinderId,
    selectedBinder,
    binderCards,
    binderCardIds,
    createBinder,
    renameBinder,
    deleteBinder,
    addCardToBinder,
    removeCardFromBinder,
  };
}
