'use client';

import type { BinderSummary } from '../../../lib/binderSummary';
import { formatGbp, summaryScope, unpricedLine } from '../../../lib/binderSummary';

type Props = {
  summary: BinderSummary;
  filterCount: number;
  shown: number;
  inSet: number;
  setName: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-stone-400">{label}</dt>
      <dd className="mt-1 truncate text-2xl font-semibold text-white">{value}</dd>
    </div>
  );
}

export function BinderSummaryCard({ summary, filterCount, shown, inSet, setName }: Props) {
  return (
    <section className="panel p-5" aria-label="Binder summary" data-testid="binder-summary">
      <p className="text-xs font-semibold text-primary-300/80">Binder summary</p>
      <p className="mt-1 text-sm text-stone-400">{summaryScope(filterCount, shown, inSet, setName)}</p>
      {summary.cards === 0 ? (
        <p className="mt-3 text-sm text-stone-300">
          {filterCount > 0
            ? 'No owned cards match your search and filters.'
            : 'No cards owned in this set yet. Tick a card to start your summary.'}
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Cards" value={String(summary.cards)} />
            <Stat label="Sets started" value={String(summary.sets)} />
            <Stat label="Value" value={summary.priced > 0 ? formatGbp(summary.value) : '--'} />
          </dl>
          <p className="mt-3 text-sm text-stone-400">
            {summary.unpriced > 0 ? unpricedLine(summary.unpriced) : 'Every card has a price'}
          </p>
        </>
      )}
    </section>
  );
}
