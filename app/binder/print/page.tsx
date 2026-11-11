'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useBinder } from '../useBinder';
import { buildChecklist } from '../../../lib/printChecklist';

export default function PrintChecklistPage() {
  const { selectedSet, owned, cards, ownedCount, total, isLoading, error } = useBinder();
  const rows = useMemo(() => buildChecklist(cards, owned), [cards, owned]);

  return (
    <main className="min-h-screen bg-white p-4 text-black print:p-0 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap gap-3 print:hidden">
          <Link href="/binder" className="inline-flex min-h-11 items-center rounded-lg border border-stone-400 px-4 text-sm font-semibold">
            Back to binder
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-11 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white"
          >
            Print
          </button>
        </div>

        <h1 className="text-2xl font-bold">{selectedSet?.name ?? 'Set checklist'}</h1>
        <p className="mb-4 text-sm">
          {ownedCount} / {total || '--'} owned
        </p>

        {isLoading ? (
          <p className="text-sm">Loading checklist...</p>
        ) : error ? (
          <p className="text-sm">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm">No cards to list.</p>
        ) : (
          <ul className="columns-1 gap-8 sm:columns-2 print:columns-2">
            {rows.map((r) => (
              <li key={r.id} className="flex break-inside-avoid items-center gap-3 border-b border-stone-300 py-1.5 text-sm">
                <span
                  aria-label={r.owned ? 'Owned' : 'Not owned'}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black text-xs font-bold leading-none"
                >
                  {r.owned ? '✓' : ''}
                </span>
                <span className="w-10 shrink-0 tabular-nums">{r.number}</span>
                <span className="min-w-0 flex-1">
                  {r.name}
                  {r.variant !== 'Normal' ? <span className="text-stone-600"> ({r.variant})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
