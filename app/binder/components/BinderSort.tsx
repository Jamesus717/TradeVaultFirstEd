'use client';

import { joinSort, splitSort, type BinderSort, type SortDir, type SortField } from '../../../lib/binderSort';

type Props = {
  value: BinderSort;
  onChange: (next: BinderSort) => void;
  // Fields with no data behind them are hidden (unless a link already chose one).
  available: { price: boolean; added: boolean };
};

const field =
  'min-h-11 rounded-xl border border-white/10 bg-stone-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-300/50';

const LABELS: Record<SortField, string> = {
  binder: 'Binder order (number)',
  name: 'Name',
  set: 'Set + card number',
  price: 'Price',
  added: 'Date added',
};

// Plain words for the direction button, per field.
const DIR_WORDS: Record<SortField, Record<SortDir, string>> = {
  binder: { asc: 'Low to high', desc: 'High to low' },
  name: { asc: 'A to Z', desc: 'Z to A' },
  set: { asc: 'A to Z', desc: 'Z to A' },
  price: { asc: 'Low to high', desc: 'High to low' },
  added: { asc: 'Oldest first', desc: 'Newest first' },
};

export function BinderSortControl({ value, onChange, available }: Props) {
  const parts = splitSort(value);
  const current = parts?.field ?? 'owned-first';
  const dir: SortDir = parts?.dir ?? 'asc';
  const show = (f: SortField) =>
    f === 'binder' || f === 'name' || f === 'set' || current === f || (f === 'price' ? available.price : available.added);

  const pickField = (next: string) => {
    if (next === 'owned-first') onChange('owned-first');
    else onChange(joinSort(next as SortField, dir));
  };

  return (
    <div className="flex gap-2" role="group" aria-label="Sort cards">
      <select
        aria-label="Sort by"
        value={current}
        onChange={(event) => pickField(event.target.value)}
        className={`${field} min-w-0 flex-1`}
      >
        {(['binder', 'name', 'set', 'price', 'added'] as const).filter(show).map((f) => (
          <option key={f} value={f}>
            {LABELS[f]}
          </option>
        ))}
        <option value="owned-first">Owned first</option>
      </select>
      <button
        type="button"
        disabled={!parts}
        onClick={() => parts && onChange(joinSort(parts.field, dir === 'asc' ? 'desc' : 'asc'))}
        aria-label={parts ? `Sort direction: ${DIR_WORDS[parts.field][dir]}. Press to reverse.` : 'Sort direction'}
        className={`${field} shrink-0 font-semibold hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-stone-500`}
      >
        <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'} </span>
        {parts ? DIR_WORDS[parts.field][dir] : 'n/a'}
      </button>
    </div>
  );
}
