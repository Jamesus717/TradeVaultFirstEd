'use client';

import { MISSING_FILTERS, missingCardsHref, setProgress } from '../../../lib/setProgress';
import type { BinderFilters } from '../../../lib/binderFilters';

type Props = {
  setId: string;
  owned: number;
  total: number;
  onShowMissing: (filters: BinderFilters) => void;
};

export function SetProgressCard({ setId, owned, total, onShowMissing }: Props) {
  const p = setProgress(owned, total);

  return (
    <div className="min-w-[240px] rounded-xl border border-primary-300/20 bg-primary-400/10 p-5">
      <p className="text-xs font-medium text-primary-100/75">Set Progress</p>
      <p className="mt-3 text-3xl font-semibold text-white">
        {p.owned} / {p.total || '--'}
      </p>
      <p className="mt-1 text-sm text-primary-50/75">
        {p.pct}% complete{p.missing > 0 ? ` · ${p.missing} to go` : p.total ? ' · set complete!' : ''}
      </p>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Set completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.pct}
      >
        <div
          className="h-full rounded-full bg-primary-400 transition-all duration-300"
          style={{ width: `${p.pct}%` }}
        />
      </div>
      {p.missing > 0 ? (
        <a
          href={missingCardsHref(setId)}
          onClick={(event) => {
            event.preventDefault();
            onShowMissing(MISSING_FILTERS);
          }}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-200 underline underline-offset-4 hover:text-white"
        >
          Show {p.missing} missing {p.missing === 1 ? 'card' : 'cards'}
        </a>
      ) : null}
    </div>
  );
}
