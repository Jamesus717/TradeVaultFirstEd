'use client';

import { useMemo, useState } from 'react';
import type { ListingTypeFilter, TradeListing } from '../types';

export type TradeSortMode = 'newest' | 'price-asc' | 'price-desc';

type Params = {
  listings: TradeListing[];
  wishlistIds?: Set<string>;
};

export function useTradeFilters({ listings, wishlistIds }: Params) {
  const [searchText, setSearchText] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<ListingTypeFilter>('all');
  const [postcodeFilter, setPostcodeFilter] = useState('');
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [sortMode, setSortMode] = useState<TradeSortMode>('newest');

  const filtersActive = Boolean(
    searchText.trim() ||
      setFilter ||
      conditionFilter ||
      typeFilter !== 'all' ||
      postcodeFilter.trim() ||
      wishlistOnly
  );

  const filteredListings = useMemo(() => {
    const nameNeedle = searchText.trim().toLowerCase();
    const postcodeNeedle = postcodeFilter.trim().toLowerCase();

    const filtered = listings.filter((listing) => {
      if (wishlistOnly && !wishlistIds?.has(listing.card_id)) {
        return false;
      }

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

    if (sortMode === 'newest') {
      return filtered;
    }
    // Listings with no price sort last either way.
    const priceOf = (listing: TradeListing) =>
      listing.price ?? (sortMode === 'price-asc' ? Infinity : -Infinity);
    return [...filtered].sort((a, b) =>
      sortMode === 'price-asc' ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a)
    );
  }, [
    conditionFilter,
    listings,
    postcodeFilter,
    searchText,
    setFilter,
    sortMode,
    typeFilter,
    wishlistIds,
    wishlistOnly,
  ]);

  const wishlistMatchCount = wishlistIds?.size
    ? listings.filter((listing) => wishlistIds.has(listing.card_id)).length
    : 0;

  function clearFilters() {
    setSearchText('');
    setSetFilter('');
    setConditionFilter('');
    setTypeFilter('all');
    setPostcodeFilter('');
    setWishlistOnly(false);
  }

  return {
    searchText,
    setSearchText,
    setFilter,
    setSetFilter,
    conditionFilter,
    setConditionFilter,
    typeFilter,
    setTypeFilter,
    postcodeFilter,
    setPostcodeFilter,
    wishlistOnly,
    setWishlistOnly,
    sortMode,
    setSortMode,
    wishlistMatchCount,
    filtersActive,
    filteredListings,
    clearFilters,
  };
}

export type TradeFiltersState = ReturnType<typeof useTradeFilters>;
