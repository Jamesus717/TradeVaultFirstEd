'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getVariantsForSet } from '../../../lib/constants/cardVariants';
import { useAuth } from '../../auth';
import type {
  CardSearchMode,
  CardSearchResult,
  ListingCondition,
  ListingType,
  ListingVariant,
  TradeListing,
} from '../types';
import { LISTING_COLUMNS, normalizePostcodePrefix } from '../utils';
import { useCardSearch } from './useCardSearch';

type Params = {
  onListingCreated: (listing: TradeListing) => void;
};

export function useListingForm({ onListingCreated }: Params) {
  const { user } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalStepCardQuery, setModalStepCardQuery] = useState('');
  const [cardSearchMode, setCardSearchMode] = useState<CardSearchMode>('collection');
  const [ownedCards, setOwnedCards] = useState<CardSearchResult[]>([]);
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

  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (uploadPreview) {
        URL.revokeObjectURL(uploadPreview);
      }
    };
  }, [uploadPreview]);

  const ownedCardIdSet = useMemo(() => new Set(ownedCards.map((card) => card.id)), [ownedCards]);

  const cardSearch = useCardSearch({
    enabled: modalOpen,
    query: modalStepCardQuery,
    mode: cardSearchMode,
    ownedCardIdSet,
    selectedCard,
  });

  const availableVariants = useMemo<ListingVariant[]>(() => {
    const setId = selectedCard?.set?.id;
    if (!setId) {
      return ['Normal', 'Reverse Holo'];
    }
    return getVariantsForSet(setId) as ListingVariant[];
  }, [selectedCard]);

  const modalCanSubmit = Boolean(
    user &&
      selectedCard &&
      condition &&
      listingType &&
      (listingType === 'sale' || listingType === 'either' ? Boolean(price.trim()) : true)
  );

  function selectCard(card: CardSearchResult) {
    setSelectedCard(card);
    const next = getVariantsForSet(card.set?.id ?? '') as ListingVariant[];
    setVariant(next[0] ?? 'Normal');
  }

  function clearSelectedCard() {
    setSelectedCard(null);
    setVariant('Normal');
  }

  function selectUploadFile(file: File | null) {
    setUploadFile(file);
    setUploadPreview(file ? URL.createObjectURL(file) : null);
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
      .select(LISTING_COLUMNS)
      .single();

    if (insertError || !data) {
      setSubmitError(insertError?.message ?? 'Failed to create listing.');
      setSubmitting(false);
      return;
    }

    onListingCreated(data as TradeListing);
    setModalOpen(false);
    setModalStepCardQuery('');
    cardSearch.clearResults();
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
    cardSearch.reset();
    setModalStepCardQuery('');
    setSelectedCard(null);
    setUploadFile(null);
    setUploadPreview(null);
    setCardSearchMode('collection');
    setOwnedCards([]);

    cardSearch.abort();

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
  }

  return {
    modalOpen,
    openModal,
    closeModal,

    modalStepCardQuery,
    setModalStepCardQuery,
    cardSearchMode,
    setCardSearchMode,
    ownedCards,
    modalCardResults: cardSearch.results,
    modalCardLoading: cardSearch.loading,
    modalCardError: cardSearch.error,

    selectedCard,
    selectCard,
    clearSelectedCard,

    availableVariants,
    variant,
    setVariant,
    condition,
    setCondition,
    listingType,
    setListingType,
    price,
    setPrice,
    tradeDescription,
    setTradeDescription,
    postcodePrefix,
    setPostcodePrefix,
    uploadPreview,
    selectUploadFile,

    submitError,
    submitting,
    modalCanSubmit,
    handleSubmitListing,
  };
}

export type ListingFormState = ReturnType<typeof useListingForm>;
