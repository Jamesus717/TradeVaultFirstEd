'use client';

import { useMemo, useState } from 'react';
import type { ListingTypeFilter, TradeListing } from '../types';

export type TradeSortMode = 'newest' | 'price-asc' | 'price-desc';

type Params = {
  listings: TradeListing[];
  wishlistIds?: Set<string>;
  shopByListing?: Record<string, string>;
};

export function useTradeFilters({ listings, wishlistIds, shopByListing }: Params) {
  const [searchText, setSearchText] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<ListingTypeFilter>('all');
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [shopFilter, setShopFilter] = useState('');
  const [sortMode, setSortMode] = useState<TradeSortMode>('newest');

  const filtersActive = Boolean(
    searchText.trim() ||
      setFilter ||
      conditionFilter ||
      typeFilter !== 'all' ||
      wishlistOnly ||
      shopFilter
  );

  const filteredListings = useMemo(() => {
    const nameNeedle = searchText.trim().toLowerCase();

    const filtered = listings.filter((listing) => {
      if (wishlistOnly && !wishlistIds?.has(listing.card_id)) {
        return false;
      }

      if (shopFilter && shopByListing?.[listing.id] !== shopFilter) {
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
    searchText,
    setFilter,
    shopByListing,
    shopFilter,
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
    setWishlistOnly(false);
    setShopFilter('');
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
    wishlistOnly,
    setWishlistOnly,
    shopFilter,
    setShopFilter,
    sortMode,
    setSortMode,
    wishlistMatchCount,
    filtersActive,
    filteredListings,
    clearFilters,
  };
}

export type TradeFiltersState = ReturnType<typeof useTradeFilters>;
