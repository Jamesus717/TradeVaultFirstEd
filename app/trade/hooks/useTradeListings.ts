'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';
import type { TradeBoardStats, TradeListing } from '../types';
import { LISTING_COLUMNS } from '../utils';

export function useTradeListings() {
  const { user } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<TradeListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState<number | null>(null);

  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [conversationByListingId, setConversationByListingId] = useState<Record<string, string>>({});

  const [manageOpenFor, setManageOpenFor] = useState<string | null>(null);

  useEffect(() => {
    const init = setTimeout(() => setNowMs(Date.now()), 0);
    const handle = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      clearTimeout(init);
      clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    async function loadListings() {
      if (!supabase) {
        setError('Supabase environment variables are missing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: listingsError } = await supabase
        .from('trade_listings')
        .select(LISTING_COLUMNS)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (listingsError) {
        setError(listingsError.message);
        setListings([]);
        setLoading(false);
        return;
      }

      setListings((data ?? []) as TradeListing[]);
      setLoading(false);
    }

    loadListings();
  }, []);

  useEffect(() => {
    async function loadInterests() {
      if (!user || !supabase) {
        setInterestedIds(new Set());
        setConversationByListingId({});
        return;
      }

      const { data } = await supabase
        .from('trade_interests')
        .select('listing_id')
        .eq('user_id', user.id);

      const next = new Set<string>();
      (data ?? []).forEach((row: { listing_id: string }) => {
        if (row.listing_id) {
          next.add(row.listing_id);
        }
      });

      setInterestedIds(next);
    }

    loadInterests();
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadConversations() {
      if (!user || !supabase) {
        if (active) {
          setConversationByListingId({});
        }
        return;
      }

      const listingIds = listings.map((listing) => listing.id);
      if (listingIds.length === 0) {
        if (active) {
          setConversationByListingId({});
        }
        return;
      }

      const { data, error: convoError } = await supabase
        .from('conversations')
        .select('id,listing_id')
        .eq('buyer_id', user.id)
        .in('listing_id', listingIds);

      if (!active) {
        return;
      }

      if (convoError) {
        setConversationByListingId({});
        return;
      }

      const map: Record<string, string> = {};
      (data ?? []).forEach((row: { id: string; listing_id: string }) => {
        if (row.listing_id && row.id) {
          map[row.listing_id] = row.id;
        }
      });
      setConversationByListingId(map);
    }

    loadConversations();

    return () => {
      active = false;
    };
  }, [listings, user]);

  const stats = useMemo<TradeBoardStats>(() => {
    const activeListings = listings.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const tradersToday = new Set(
      listings
        .filter((listing) => new Date(listing.created_at).getTime() >= todayMs)
        .map((listing) => listing.user_id)
    ).size;

    const setsRepresented = new Set(listings.map((listing) => listing.set_id)).size;

    return { activeListings, tradersToday, setsRepresented };
  }, [listings]);

  const setOptions = useMemo(() => {
    const map = new Map<string, string>();
    listings.forEach((listing) => {
      if (listing.set_name && listing.set_id) {
        map.set(listing.set_name, listing.set_name);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  async function handleExpressInterest(listingId: string) {
    if (!user || !supabase) {
      return;
    }

    const listing = listings.find((row) => row.id === listingId);
    if (!listing) {
      return;
    }

    if (listing.user_id === user.id) {
      return;
    }

    const existingConversationId = conversationByListingId[listingId];
    if (existingConversationId) {
      router.push(`/inbox/${existingConversationId}`);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (!existingError && existing?.id) {
      setConversationByListingId((current) => ({ ...current, [listingId]: existing.id }));
      router.push(`/inbox/${existing.id}`);
      return;
    }

    await supabase.from('trade_interests').insert({
      listing_id: listingId,
      user_id: user.id,
      message: null,
    });

    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.user_id,
      })
      .select('id')
      .single();

    if (createError || !created?.id) {
      const { data: fallback } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (fallback?.id) {
        setConversationByListingId((current) => ({ ...current, [listingId]: fallback.id }));
        router.push(`/inbox/${fallback.id}`);
      }
      return;
    }

    const conversationId = created.id as string;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: null,
      content: 'Conversation started',
      message_type: 'system',
    });

    await supabase.from('notifications').insert({
      user_id: listing.user_id,
      type: 'new_message',
      conversation_id: conversationId,
      message: `New conversation about ${listing.card_name}`,
    });

    setInterestedIds((current) => {
      const next = new Set(current);
      next.add(listingId);
      return next;
    });
    setConversationByListingId((current) => ({ ...current, [listingId]: conversationId }));
    router.push(`/inbox/${conversationId}`);
  }

  async function handleMarkSold(listingId: string) {
    if (!user || !supabase) {
      return;
    }

    await supabase.from('trade_listings').update({ is_active: false }).eq('id', listingId);
    setListings((current) => current.filter((listing) => listing.id !== listingId));
    setManageOpenFor(null);
  }

  async function handleDeleteListing(listingId: string) {
    if (!user || !supabase) {
      return;
    }

    await supabase.from('trade_listings').delete().eq('id', listingId);
    setListings((current) => current.filter((listing) => listing.id !== listingId));
    setManageOpenFor(null);
  }

  function addListing(listing: TradeListing) {
    setListings((current) => [listing, ...current]);
  }

  return {
    listings,
    loading,
    error,
    nowMs,
    interestedIds,
    conversationByListingId,
    manageOpenFor,
    setManageOpenFor,
    stats,
    setOptions,
    addListing,
    handleExpressInterest,
    handleMarkSold,
    handleDeleteListing,
  };
}
