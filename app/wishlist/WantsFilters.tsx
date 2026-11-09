'use client';

import {
  PRIORITIES,
  joinWantSort,
  splitWantSort,
  type WantFilters,
  type WantSort,
  type WantSortDir,
  type WantSortField,
} from '../../lib/wantsFilters';

type Props = {
  filters: WantFilters;
  sort: WantSort;
  sets: { key: string; label: string }[];
  showAdded: boolean;
  activeCount: number;
  onFilters: (next: WantFilters) => void;
  onSort: (next: WantSort) => void;
  onClear: () => void;
};

// Same look as the binder filter/sort controls.
const field =
  'min-h-11 rounded-xl border border-white/10 bg-stone-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-300/50';
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
    on
      ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
      : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
  }`;

const LABELS: Record<WantSortField, string> = { priority: 'Priority', name: 'Name', added: 'Date added' };
const DIR_WORDS: Record<WantSortField, Record<WantSortDir, string>> = {
  priority: { desc: 'High first', asc: 'Low first' },
  name: { asc: 'A to Z', desc: 'Z to A' },
  added: { desc: 'Newest first', asc: 'Oldest first' },
};

export function WantsFiltersBar({ filters, sort, sets, showAdded, activeCount, onFilters, onSort, onClear }: Props) {
  const { field: sortField, dir } = splitWantSort(sort);
  const fields = (['priority', 'name', 'added'] as const).filter((f) => f !== 'added' || showAdded || sortField === 'added');
  return (
    <div className="space-y-3" aria-label="Filter and sort your wishlist" role="group">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-400">
          Search your list
          <input
            type="search"
            value={filters.q}
            maxLength={80}
            onChange={(e) => onFilters({ ...filters, q: e.target.value })}
            placeholder="Card name"
            className={`${field} mt-1 w-full placeholder:text-stone-500`}
          />
        </label>
        {sets.length > 1 || filters.set ? (
          <label className="block text-sm font-medium text-stone-400">
            Set
            <select
              value={filters.set}
              onChange={(e) => onFilters({ ...filters, set: e.target.value })}
              className={`${field} mt-1 w-full`}
            >
              <option value="">All sets</option>
              {sets.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
              {filters.set && !sets.some((s) => s.key === filters.set) ? (
                <option value={filters.set}>{filters.set}</option>
              ) : null}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Priority">
        <span className="text-sm font-medium text-stone-400">Priority</span>
        {(['all', ...PRIORITIES] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={filters.priority === p}
            onClick={() => onFilters({ ...filters, priority: p })}
            className={chip(filters.priority === p)}
          >
            {p === 'all' ? 'All' : p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 sm:max-w-md" role="group" aria-label="Sort wishlist">
        <select
          aria-label="Sort by"
          value={sortField}
          onChange={(e) => onSort(joinWantSort(e.target.value as WantSortField, dir))}
          className={`${field} min-w-0 flex-1`}
        >
          {fields.map((f) => (
            <option key={f} value={f}>
              {LABELS[f]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onSort(joinWantSort(sortField, dir === 'asc' ? 'desc' : 'asc'))}
          aria-label={`Sort direction: ${DIR_WORDS[sortField][dir]}. Press to reverse.`}
          className={`${field} shrink-0 font-semibold hover:bg-white/[0.06]`}
        >
          <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'} </span>
          {DIR_WORDS[sortField][dir]}
        </button>
      </div>

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
