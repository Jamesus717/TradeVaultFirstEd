'use client';

import { FILTER_CONDITIONS, type BinderFilters, type FilterCondition } from '../../../lib/binderFilters';

type Props = {
  filters: BinderFilters;
  onChange: (next: BinderFilters) => void;
  onClear: () => void;
  activeCount: number;
  // Which optional filters have data behind them. A hidden filter is not an error.
  available: { condition: boolean; price: boolean };
};

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
    on
      ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
      : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
  }`;

const field =
  'min-h-11 w-full rounded-xl border border-white/10 bg-stone-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-300/50';

function toNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function BinderFiltersBar({ filters, onChange, onClear, activeCount, available }: Props) {
  const toggleCond = (c: FilterCondition) =>
    onChange({
      ...filters,
      cond: filters.cond.includes(c) ? filters.cond.filter((x) => x !== c) : [...filters.cond, c],
    });

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Owned or missing">
        {(
          [
            { value: 'all', label: 'All Cards' },
            { value: 'owned', label: '✓ Owned' },
            { value: 'unowned', label: 'Missing' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.own === value}
            onClick={() => onChange({ ...filters, own: value })}
            className={chip(filters.own === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {available.condition ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Condition">
          <span className="text-sm font-medium text-stone-400">Condition</span>
          {FILTER_CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filters.cond.includes(c)}
              onClick={() => toggleCond(c)}
              className={chip(filters.cond.includes(c))}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {available.price ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md" role="group" aria-label="Price range">
          <label className="block text-sm font-medium text-stone-400">
            Min price (£)
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={filters.min ?? ''}
              onChange={(e) => onChange({ ...filters, min: toNumber(e.target.value) })}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium text-stone-400">
            Max price (£)
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={filters.max ?? ''}
              onChange={(e) => onChange({ ...filters, max: toNumber(e.target.value) })}
              className={`${field} mt-1`}
            />
          </label>
        </div>
      ) : null}

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-primary-200 hover:bg-white/[0.06]"
        >
          Clear all filters ({activeCount})
        </button>
      ) : null}
    </div>
  );
}
