'use client';

import type { TradeFiltersState } from '../hooks/useTradeFilters';
import { classNames } from '../utils';

type Props = {
  filters: TradeFiltersState;
  setOptions: string[];
};

export function TradeFilterBar({ filters, setOptions }: Props) {
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
    filtersActive,
    clearFilters,
  } = filters;

  return (
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
            onClick={clearFilters}
            className="self-start text-sm text-stone-400 hover:text-white lg:self-auto"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
