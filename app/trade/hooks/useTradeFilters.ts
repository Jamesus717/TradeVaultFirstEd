'use client';

import { useMemo, useState } from 'react';
import type { ListingTypeFilter, TradeListing } from '../types';

type Params = {
  listings: TradeListing[];
};

export function useTradeFilters({ listings }: Params) {
  const [searchText, setSearchText] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<ListingTypeFilter>('all');
  const [postcodeFilter, setPostcodeFilter] = useState('');

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

  function clearFilters() {
    setSearchText('');
    setSetFilter('');
    setConditionFilter('');
    setTypeFilter('all');
    setPostcodeFilter('');
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
    filtersActive,
    filteredListings,
    clearFilters,
  };
}

export type TradeFiltersState = ReturnType<typeof useTradeFilters>;
