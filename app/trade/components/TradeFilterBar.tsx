'use client';

import type { TradeFiltersState, TradeSortMode } from '../hooks/useTradeFilters';
import { classNames } from '../utils';

type Props = {
  filters: TradeFiltersState;
  setOptions: string[];
  hasWishlist: boolean;
};

export function TradeFilterBar({ filters, setOptions, hasWishlist }: Props) {
  const {
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
    filtersActive,
    clearFilters,
  } = filters;

  return (
    <section className="panel mt-6 space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search card name..."
          className="w-full rounded-xl border border-white/10 bg-stone-950/80 px-4 py-3 text-sm text-white outline-none"
        />

        <select
          value={setFilter}
          onChange={(event) => setSetFilter(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-stone-950/80 px-4 py-3 text-sm text-white outline-none"
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
          className="w-full rounded-xl border border-white/10 bg-stone-950/80 px-4 py-3 text-sm text-white outline-none"
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

        <input
          value={postcodeFilter}
          onChange={(event) => setPostcodeFilter(event.target.value)}
          placeholder="Postcode prefix e.g. SW1"
          className="w-full rounded-xl border border-white/10 bg-stone-950/80 px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        {hasWishlist ? (
          <button
            type="button"
            onClick={() => setWishlistOnly(!wishlistOnly)}
            className={classNames(
              'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors',
              wishlistOnly
                ? 'border-primary-300/30 bg-primary-400/15 text-primary-100'
                : 'border-white/10 bg-white/[0.03] text-stone-400 hover:text-stone-200'
            )}
          >
            ★ My wishlist
          </button>
        ) : null}

        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as TradeSortMode)}
          aria-label="Sort listings"
          className="ml-auto rounded-xl border border-white/10 bg-stone-950/80 px-3 py-2 text-sm text-stone-200 outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>

        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-stone-400 underline-offset-4 hover:text-white hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
