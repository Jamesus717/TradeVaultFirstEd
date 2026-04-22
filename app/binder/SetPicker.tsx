'use client';

import type { PokemonSet } from './types';

type Props = {
  groupedSets: Record<string, PokemonSet[]>;
  selectedSetId: string;
  onChange: (nextSetId: string) => void;
  disabled: boolean;
  selectedSetLabel: string;
};

export function SetPicker({ groupedSets, selectedSetId, onChange, disabled, selectedSetLabel }: Props) {
  return (
    <div className="max-w-xl">
      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.25em] text-stone-400">
        Select Set
      </label>
      <select
        value={selectedSetId}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-stone-900 px-4 py-3 text-sm text-white outline-none"
        disabled={disabled}
      >
        {Object.entries(groupedSets).map(([series, seriesSets]) => (
          <optgroup key={series} label={series}>
            {seriesSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="mt-2 text-sm text-stone-400">{selectedSetLabel}</p>
    </div>
  );
}

