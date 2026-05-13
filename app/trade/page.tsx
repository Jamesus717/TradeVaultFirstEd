'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getVariantsForSet } from '../../lib/constants/cardVariants';
import { useAuth } from '../auth';

type ListingVariant = 'Normal' | 'Reverse Holo' | '1st Edition' | 'Shadowless' | 'Unlimited';
type ListingCondition =
  | 'Mint'
  | 'Near Mint'
  | 'Lightly Played'
  | 'Moderately Played'
  | 'Heavily Played';
type ListingType = 'trade' | 'sale' | 'either';

type TradeListing = {
  id: string;
  user_id: string;
  card_id: string;
  card_name: string;
  set_name: string;
  set_id: string;
  card_number: string;
  variant: ListingVariant;
  condition: ListingCondition;
  listing_type: ListingType;
  price: number | null;
  trade_description: string | null;
  postcode_prefix: string | null;
  image_url: string | null;
  card_image_url: string | null;
  created_at: string;
  is_active: boolean;
};

type CardSearchResult = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: { id: string; name: string; series: string; releaseDate?: string };
  images?: { small?: string; large?: string };
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatMoneyGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatTimeAgo(iso: string, nowMs: number | null) {
  if (!nowMs) {
    return '';
  }
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return '';
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - created) / 1000));

  if (diffSeconds < 20) {
    return 'just now';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function conditionBadgeClass(condition: ListingCondition) {
  if (condition === 'Mint' || condition === 'Near Mint') {
    return 'bg-primary-400/90 text-primary-950';
  }

  if (condition === 'Lightly Played') {
    return 'bg-amber-400/90 text-amber-950';
  }

  return 'bg-rose-400/90 text-rose-950';
}

function listingTypeBadge(listingType: ListingType) {
  if (listingType === 'trade') {
    return { label: 'TRADE', className: 'bg-blue-400/90 text-blue-950' };
  }

  if (listingType === 'sale') {
    return { label: 'SALE', className: 'bg-primary-400/90 text-primary-950' };
  }

  return { label: 'TRADE OR SALE', className: 'bg-purple-400/90 text-purple-950' };
}

function canReverseHolo(rarity?: string) {
  return Boolean(rarity && new Set(['Common', 'Uncommon', 'Rare']).has(rarity));
}

function normalizePostcodePrefix(value: string) {
  return value.trim().toUpperCase().slice(0, 4);
}

export default function TradeBoardPage() {
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<TradeListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState<number | null>(null);

  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [conversationByListingId, setConversationByListingId] = useState<Record<string, string>>({});

  const [searchText, setSearchText] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'trade' | 'sale'>('all');
  const [postcodeFilter, setPostcodeFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalStepCardQuery, setModalStepCardQuery] = useState('');
  const [cardSearchMode, setCardSearchMode] = useState<'collection' | 'all'>('collection');
  const [ownedCards, setOwnedCards] = useState<CardSearchResult[]>([]);
  const [modalCardResults, setModalCardResults] = useState<CardSearchResult[]>([]);
  const [modalCardLoading, setModalCardLoading] = useState(false);
  const [modalCardError, setModalCardError] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(null);

  const [variant, setVariant] = useState<ListingVariant>('Normal');
  const [condition, setCondition] = useState<ListingCondition>('Near Mint');
  const [listingType, setListingType] = useState<ListingType>('trade');
  const [price, setPrice] = useState('');
  const [tradeDescription, setTradeDescription] = useState('');
  const [postcodePrefix, setPostcodePrefix] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [manageOpenFor, setManageOpenFor] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const cardSearchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (uploadPreview) {
        URL.revokeObjectURL(uploadPreview);
      }
    };
  }, [uploadPreview]);

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
        .select(
          'id,user_id,card_id,card_name,set_name,set_id,card_number,variant,condition,listing_type,price,trade_description,postcode_prefix,image_url,card_image_url,created_at,is_active'
        )
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

  const stats = useMemo(() => {
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

  const filtersActive = Boolean(
    searchText.trim() ||
      setFilter ||
      conditionFilter ||
      typeFilter !== 'all' ||
      postcodeFilter.trim()
  );

  const filteredListings = useMemo(() => {
    const nameNeedle = searchText.trim().toLowerCase();
    const postcodeNeedle = postcodeFilter.trim().toLowerCase();

    return listings.filter((listing) => {
      if (nameNeedle && !listing.card_name.toLowerCase().includes(nameNeedle)) {
        return false;
      }

      if (setFilter && listing.set_name !== setFilter) {
        return false;
      }

      if (conditionFilter && listing.condition !== conditionFilter) {
        return false;
      }

      if (typeFilter !== 'all') {
        if (typeFilter === 'trade' && listing.listing_type === 'sale') {
          return false;
        }
        if (typeFilter === 'sale' && listing.listing_type === 'trade') {
          return false;
        }
      }

      if (postcodeNeedle) {
        const prefix = (listing.postcode_prefix ?? '').toLowerCase();
        if (!prefix.startsWith(postcodeNeedle)) {
          return false;
        }
      }

      return true;
    });
  }, [conditionFilter, listings, postcodeFilter, searchText, setFilter, typeFilter]);

  const ownedCardIdSet = useMemo(() => new Set(ownedCards.map((card) => card.id)), [ownedCards]);

  const availableVariants = useMemo<ListingVariant[]>(() => {
    const setId = selectedCard?.set?.id;
    if (!setId) {
      return ['Normal', 'Reverse Holo'];
    }
    return getVariantsForSet(setId) as ListingVariant[];
  }, [selectedCard]);

  useEffect(() => {
    async function searchCards() {
      const needle = modalStepCardQuery.trim();

      if (!modalOpen || selectedCard || needle.length < 2) {
        setModalCardResults([]);
        setModalCardLoading(false);
        setModalCardError('');
        return;
      }

      setModalCardLoading(true);
      setModalCardError('');

      if (cardSearchMode === 'collection' && ownedCardIdSet.size === 0) {
        setModalCardResults([]);
        setModalCardLoading(false);
        return;
      }

      if (cardSearchAbortRef.current) {
        cardSearchAbortRef.current.abort();
      }

      const controller = new AbortController();
      cardSearchAbortRef.current = controller;

      try {
        const response = await fetch(
          `/api/pokemon/search/cards?name=${encodeURIComponent(needle)}&pageSize=12`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Card search failed.');
        }

        const json = (await response.json()) as { data?: CardSearchResult[] };
        const allResults = json.data ?? [];
        const results =
          cardSearchMode === 'collection'
            ? allResults.filter((card) => ownedCardIdSet.has(card.id))
            : allResults;
        setModalCardResults(results);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }

        setModalCardResults([]);
        setModalCardError('Card search failed.');
      } finally {
        setModalCardLoading(false);
      }
    }

    const handle = setTimeout(searchCards, 400);
    return () => clearTimeout(handle);
  }, [cardSearchMode, modalOpen, modalStepCardQuery, ownedCardIdSet, selectedCard]);

  const modalCanSubmit = Boolean(
    user &&
      selectedCard &&
      condition &&
      listingType &&
      (listingType === 'sale' || listingType === 'either' ? Boolean(price.trim()) : true)
  );

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

  async function handleSubmitListing() {
    if (!user || !supabase || !selectedCard) {
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const trimmedPostcode = postcodePrefix.trim();
    const normalizedPostcode = trimmedPostcode ? normalizePostcodePrefix(trimmedPostcode) : null;

    const numericPrice =
      listingType === 'sale' || listingType === 'either'
        ? Number.parseFloat(price)
        : null;

    if ((listingType === 'sale' || listingType === 'either') && (!numericPrice || numericPrice <= 0)) {
      setSubmitError('Enter a valid price.');
      setSubmitting(false);
      return;
    }

    if (!selectedCard.set?.id || !selectedCard.set?.name) {
      setSubmitError('Selected card is missing set information.');
      setSubmitting(false);
      return;
    }

    let uploadedUrl: string | null = null;

    if (uploadFile) {
      if (!uploadFile.type.startsWith('image/')) {
        setSubmitError('Photo must be an image.');
        setSubmitting(false);
        return;
      }

      if (uploadFile.size > 5 * 1024 * 1024) {
        setSubmitError('Photo must be 5MB or less.');
        setSubmitting(false);
        return;
      }

      const extension = uploadFile.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('trade-images')
        .upload(path, uploadFile, {
          contentType: uploadFile.type,
          upsert: false,
        });

      if (uploadError) {
        setSubmitError(uploadError.message);
        setSubmitting(false);
        return;
      }

      uploadedUrl = supabase.storage.from('trade-images').getPublicUrl(path).data.publicUrl;
    }

    const cardImageUrl = selectedCard.images?.large ?? selectedCard.images?.small ?? null;

    const payload = {
      user_id: user.id,
      card_id: selectedCard.id,
      card_name: selectedCard.name,
      set_name: selectedCard.set.name,
      set_id: selectedCard.set.id,
      card_number: selectedCard.number,
      variant,
      condition,
      listing_type: listingType,
      price: numericPrice,
      trade_description:
        listingType === 'trade' || listingType === 'either'
          ? tradeDescription.trim() || null
          : null,
      postcode_prefix: normalizedPostcode,
      image_url: uploadedUrl,
      card_image_url: cardImageUrl,
      is_active: true,
    };

    const { data, error: insertError } = await supabase
      .from('trade_listings')
      .insert(payload)
      .select(
        'id,user_id,card_id,card_name,set_name,set_id,card_number,variant,condition,listing_type,price,trade_description,postcode_prefix,image_url,card_image_url,created_at,is_active'
      )
      .single();

    if (insertError || !data) {
      setSubmitError(insertError?.message ?? 'Failed to create listing.');
      setSubmitting(false);
      return;
    }

    setListings((current) => [data as TradeListing, ...current]);
    setModalOpen(false);
    setModalStepCardQuery('');
    setModalCardResults([]);
    setSelectedCard(null);
    setVariant('Normal');
    setCondition('Near Mint');
    setListingType('trade');
    setPrice('');
    setTradeDescription('');
    setPostcodePrefix('');
    setUploadFile(null);
    setUploadPreview(null);
    setSubmitting(false);
  }

  async function openModal() {
    if (!user) {
      return;
    }

    setModalOpen(true);
    setSubmitError('');

    if (!supabase) {
      setOwnedCards([]);
      return;
    }

    const { data, error: ownedError } = await supabase
      .from('user_cards')
      .select('card_id')
      .eq('user_id', user.id)
      .eq('owned', true);

    if (ownedError || !data) {
      setOwnedCards([]);
      return;
    }

    const mapped = (data as Array<{
      card_id: string;
    }>).map((row) => ({
      id: row.card_id,
      name: row.card_id,
      number: '',
    }));

    setOwnedCards(mapped);
  }

  function closeModal() {
    setModalOpen(false);
    setSubmitError('');
    setModalCardError('');
    setModalCardLoading(false);
    setModalCardResults([]);
    setModalStepCardQuery('');
    setSelectedCard(null);
    setUploadFile(null);
    setUploadPreview(null);
    setCardSearchMode('collection');
    setOwnedCards([]);

    if (cardSearchAbortRef.current) {
      cardSearchAbortRef.current.abort();
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
  }

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-4xl font-semibold text-white">Trade Board</h1>
                <p className="mt-2 text-sm text-stone-400">
                  Buy, sell and trade Pokemon cards with collectors near you
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                    <span className="text-stone-400">Active Listings:</span>{' '}
                    <span className="font-semibold text-white">{stats.activeListings}</span>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                    <span className="text-stone-400">Traders Online Today:</span>{' '}
                    <span className="font-semibold text-white">{stats.tradersToday}</span>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-stone-200">
                    <span className="text-stone-400">Sets Represented:</span>{' '}
                    <span className="font-semibold text-white">{stats.setsRepresented}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openModal}
                  disabled={!user || authLoading}
                  title={!user ? 'Sign in to list a card' : undefined}
                  className={classNames(
                    'rounded-2xl px-6 py-3 text-sm font-semibold transition-colors',
                    user
                      ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                      : 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                  )}
                >
                  List a Card
                </button>
              </div>
            </div>
          </div>
        </section>

        {!user && !authLoading ? (
          <div className="mt-4 rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-4 text-center text-sm text-amber-200/80">
            Sign in to list cards and express interest in trades
          </div>
        ) : null}

        <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search card name..."
              className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
            />

            <select
              value={setFilter}
              onChange={(event) => setSetFilter(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none lg:w-56"
            >
              <option value="">All Sets</option>
              {setOptions.map((setName) => (
                <option key={setName} value={setName}>
                  {setName}
                </option>
              ))}
            </select>

            <select
              value={conditionFilter}
              onChange={(event) => setConditionFilter(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none lg:w-56"
            >
              <option value="">Any Condition</option>
              {(['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played'] as const).map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                )
              )}
            </select>

            <div className="flex items-center gap-2">
              {(['all', 'trade', 'sale'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  className={classNames(
                    'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition-colors',
                    typeFilter === value
                      ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                      : 'border-white/10 bg-white/[0.03] text-stone-400 hover:text-stone-200'
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <input
              value={postcodeFilter}
              onChange={(event) => setPostcodeFilter(event.target.value)}
              placeholder="Postcode prefix e.g. SW1"
              className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none lg:w-64"
            />

            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setSearchText('');
                  setSetFilter('');
                  setConditionFilter('');
                  setTypeFilter('all');
                  setPostcodeFilter('');
                }}
                className="self-start text-sm text-stone-400 hover:text-white lg:self-auto"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="animate-pulse overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04]"
                >
                  <div className="aspect-[3/4] bg-white/[0.06]" />
                  <div className="space-y-3 p-4">
                    <div className="h-3 w-24 rounded bg-white/[0.06]" />
                    <div className="h-4 w-4/5 rounded bg-white/[0.06]" />
                    <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                    <div className="h-8 w-full rounded bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur">
              <div className="text-5xl">🃏</div>
              <h2 className="text-2xl font-semibold text-white">No listings found</h2>
              <p className="text-sm text-stone-400">Be the first to list a card.</p>
              <button
                type="button"
                onClick={openModal}
                disabled={!user}
                className={classNames(
                  'mt-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-colors',
                  user
                    ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                    : 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                )}
              >
                List a Card
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredListings.map((listing) => {
                const image = listing.image_url || listing.card_image_url || '';
                const typeBadge = listingTypeBadge(listing.listing_type);
                const isOwner = Boolean(user && user.id === listing.user_id);
                const interested = interestedIds.has(listing.id);
                const conversationId = conversationByListingId[listing.id] ?? null;
                const showOpenChat = Boolean(conversationId) || interested;
                const sellerInitial = (listing.user_id[0] ?? '?').toUpperCase();

                return (
                  <article
                    key={listing.id}
                    className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <div className="relative aspect-[3/4] bg-stone-900">
                      {image ? (
                        <Image
                          src={image}
                          alt={listing.card_name}
                          fill
                          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-stone-600">
                          No image
                        </div>
                      )}

                      <div className="absolute left-0 top-0 flex w-full items-start justify-between p-2">
                        <div
                          className={classNames(
                            'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                            conditionBadgeClass(listing.condition)
                          )}
                        >
                          {listing.condition}
                        </div>
                        <div
                          className={classNames(
                            'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                            typeBadge.className
                          )}
                        >
                          {typeBadge.label}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
                        {listing.set_name}
                      </p>
                      <h3 className="text-base font-semibold text-white leading-tight">
                        {listing.card_name}
                      </h3>
                      <p className="text-xs text-stone-400">
                        #{listing.card_number} · {listing.variant}
                      </p>

                      {listing.listing_type === 'trade' ? (
                        <p className="line-clamp-1 text-sm italic text-stone-300">
                          {listing.trade_description ?? 'Open to offers'}
                        </p>
                      ) : listing.listing_type === 'sale' ? (
                        <p className="text-lg font-semibold text-primary-400">
                          {listing.price ? formatMoneyGBP(listing.price) : 'Price on request'}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-lg font-semibold text-primary-400">
                            {listing.price ? formatMoneyGBP(listing.price) : 'Price on request'}
                          </p>
                          {listing.trade_description ? (
                            <p className="line-clamp-1 text-sm italic text-stone-300">
                              {listing.trade_description}
                            </p>
                          ) : null}
                        </div>
                      )}

                      {listing.postcode_prefix ? (
                        <p className="text-xs text-stone-400">
                          <span className="mr-1">📍</span>
                          {listing.postcode_prefix} area
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-400/30 bg-primary-400/20 text-xs font-semibold text-primary-300">
                            {sellerInitial}
                          </div>
                          <p className="text-xs text-stone-400">{formatTimeAgo(listing.created_at, nowMs)}</p>
                        </div>

                        {isOwner ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setManageOpenFor((current) => (current === listing.id ? null : listing.id))}
                              className="rounded-xl bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-100 transition-colors hover:bg-white/[0.08]"
                            >
                              Manage
                            </button>
                            {manageOpenFor === listing.id ? (
                              <div className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-2xl border border-white/10 bg-stone-950/95 shadow-2xl shadow-black/30 backdrop-blur">
                                <button
                                  type="button"
                                  onClick={() => handleMarkSold(listing.id)}
                                  className="w-full px-4 py-3 text-left text-sm text-stone-200 hover:bg-white/[0.06]"
                                >
                                  Mark as sold
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteListing(listing.id)}
                                  className="w-full px-4 py-3 text-left text-sm text-rose-200 hover:bg-white/[0.06]"
                                >
                                  Delete listing
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExpressInterest(listing.id)}
                            disabled={!user}
                            className={classNames(
                              'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                              showOpenChat
                                ? 'bg-primary-400/20 text-primary-200 hover:bg-primary-400/30'
                                : 'bg-stone-800 text-stone-100 hover:bg-primary-400 hover:text-primary-950',
                              !user ? 'cursor-not-allowed opacity-60' : ''
                            )}
                          >
                            {showOpenChat ? 'Open Chat' : "I'm Interested"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {modalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-stone-900 p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">List a Card</h2>
                  <p className="mt-1 text-sm text-stone-400">Create a trade or sale listing.</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
                    Step 1 — Find your card
                  </p>

                  {selectedCard ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="h-20 w-14 overflow-hidden rounded-xl bg-stone-950/80 ring-1 ring-white/5">
                        {selectedCard.images?.small ? (
                          <Image
                            src={selectedCard.images.small}
                            alt={selectedCard.name}
                            width={112}
                            height={160}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-stone-500">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{selectedCard.name}</p>
                        <p className="truncate text-xs text-stone-400">
                          {selectedCard.set?.name ?? 'Unknown set'} · #{selectedCard.number}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(null);
                          setVariant('Normal');
                        }}
                        className="text-sm font-medium text-primary-300 hover:text-primary-200"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCardSearchMode('collection')}
                          className={classNames(
                            'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                            cardSearchMode === 'collection'
                              ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                              : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
                          )}
                        >
                          My Collection
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardSearchMode('all')}
                          className={classNames(
                            'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                            cardSearchMode === 'all'
                              ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                              : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
                          )}
                        >
                          All Cards
                        </button>
                      </div>

                      <input
                        value={modalStepCardQuery}
                        onChange={(event) => setModalStepCardQuery(event.target.value)}
                        placeholder="Search card name e.g. Charizard"
                        className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                      />

                      {modalCardError ? (
                        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                          {modalCardError}
                        </div>
                      ) : null}

                      {modalCardLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <div
                              key={`row-${index}`}
                              className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                            />
                          ))}
                        </div>
                      ) : modalCardResults.length > 0 ? (
                        <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03]">
                          {modalCardResults.map((card) => {
                            const isOwned = ownedCards.some((owned) => owned.id === card.id);
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCard(card);
                                  const next = getVariantsForSet(card.set?.id ?? '') as ListingVariant[];
                                  setVariant(next[0] ?? 'Normal');
                                }}
                                className="flex w-full items-center gap-3 border-b border-white/10 p-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.05]"
                              >
                                <div className="relative h-16 w-12 overflow-hidden rounded-xl bg-stone-950/80 ring-1 ring-white/5">
                                  {card.images?.small ? (
                                    <Image
                                      src={card.images.small}
                                      alt={card.name}
                                      fill
                                      sizes="48px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-500">
                                      No image
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-white">{card.name}</p>
                                    {cardSearchMode === 'all' && isOwned ? (
                                      <span className="rounded-full border border-primary-300/20 bg-primary-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-200">
                                        Owned
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="truncate text-xs text-stone-400">
                                    {card.set?.name ?? 'Unknown set'} · #{card.number}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : modalStepCardQuery.trim().length >= 2 ? (
                        cardSearchMode === 'collection' ? (
                          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-300">
                            <p>No matching cards in your collection.</p>
                            <button
                              type="button"
                              onClick={() => setCardSearchMode('all')}
                              className="rounded-2xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300"
                            >
                              Search All Cards
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-300">
                            No results.
                          </div>
                        )
                      ) : null}
                    </>
                  )}
                </div>

                <div className={classNames(!selectedCard ? 'opacity-60' : '')}>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
                    Step 2 — Listing details
                  </p>

                  <div className="mt-3 space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-stone-200">Variant</p>
                      <div className="flex items-center gap-2">
                        {availableVariants.map((value) => {
                          const reverseDisabled =
                            value === 'Reverse Holo' && !canReverseHolo(selectedCard?.rarity);

                          return (
                            <button
                              key={value}
                              type="button"
                              disabled={!selectedCard || reverseDisabled}
                              onClick={() => setVariant(value)}
                              className={classNames(
                                'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                                variant === value
                                  ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                                  : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]',
                                !selectedCard || reverseDisabled ? 'cursor-not-allowed opacity-50' : ''
                              )}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-stone-200">Condition</p>
                      <select
                        value={condition}
                        onChange={(event) => setCondition(event.target.value as ListingCondition)}
                        disabled={!selectedCard}
                        className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                      >
                        {(['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played'] as const).map(
                          (value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-stone-200">Listing type</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {([
                          { value: 'trade', label: 'Trade Only' },
                          { value: 'sale', label: 'Sale Only' },
                          { value: 'either', label: 'Trade or Sale' },
                        ] as const).map((entry) => (
                          <button
                            key={entry.value}
                            type="button"
                            disabled={!selectedCard}
                            onClick={() => setListingType(entry.value)}
                            className={classNames(
                              'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                              listingType === entry.value
                                ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                                : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]',
                              !selectedCard ? 'cursor-not-allowed opacity-50' : ''
                            )}
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {listingType === 'sale' || listingType === 'either' ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-stone-200">Price</p>
                        <div className="flex items-center gap-2">
                          <div className="rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-stone-300">
                            £
                          </div>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={price}
                            onChange={(event) => setPrice(event.target.value)}
                            placeholder="Price"
                            disabled={!selectedCard}
                            className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                          />
                        </div>
                      </div>
                    ) : null}

                    {listingType === 'trade' || listingType === 'either' ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-stone-200">Trade description</p>
                        <textarea
                          rows={2}
                          value={tradeDescription}
                          onChange={(event) => setTradeDescription(event.target.value)}
                          placeholder="What would you trade for? e.g. Looking for Charizard ex full art"
                          disabled={!selectedCard}
                          className="w-full resize-none rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-stone-200">Postcode prefix</p>
                      <input
                        value={postcodePrefix}
                        onChange={(event) => setPostcodePrefix(event.target.value)}
                        placeholder="e.g. SW1, M1, EH1"
                        disabled={!selectedCard}
                        className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                      />
                      <p className="text-xs text-stone-500">
                        Only the first part — we never store your full postcode
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-stone-200">Photo upload (optional)</p>
                      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/10 p-6 text-center transition-colors hover:border-primary-400/40">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setUploadFile(file);
                            setUploadPreview(file ? URL.createObjectURL(file) : null);
                          }}
                          disabled={!selectedCard}
                        />
                        {uploadPreview ? (
                          <div className="mx-auto w-40 overflow-hidden rounded-2xl border border-white/10 bg-stone-950/50">
                            <Image
                              src={uploadPreview}
                              alt="Upload preview"
                              width={320}
                              height={240}
                              className="h-auto w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="text-sm text-stone-400">
                            Drag and drop or click to upload
                            <div className="mt-1 text-xs text-stone-500">Image only · max 5MB</div>
                          </div>
                        )}
                      </label>
                    </div>

                    {submitError ? (
                      <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                        {submitError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSubmitListing}
                      disabled={!modalCanSubmit || submitting}
                      className={classNames(
                        'w-full rounded-2xl py-3 text-sm font-semibold transition-colors',
                        modalCanSubmit
                          ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                          : 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400',
                        submitting ? 'opacity-70' : ''
                      )}
                    >
                      {submitting ? 'Submitting…' : 'Create listing'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
