'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { EmptyState } from '../components/EmptyState';
import { useCollection } from './useCollection';
import { useSetOwnedVariants } from './useSetOwnedVariants';

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-white/10" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, pct) / 100)}
          className="stroke-primary-400 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
        {pct}%
      </span>
    </div>
  );
}

function SetExpandableCard({
  set,
  ownedRows,
}: {
  set: ReturnType<typeof useCollection>['ownedSets'][0];
  ownedRows: ReturnType<typeof useCollection>['ownedRows'];
}) {
  const [expanded, setExpanded] = useState(false);
  const { cards, loading } = useSetOwnedVariants({ selectedSetId: set.setId, ownedRows });

  return (
    <article className="panel overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.05] transition-colors"
      >
        {/* Left: Logo */}
        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-primary-400/10 border border-primary-300/20">
          {set.logoUrl ? (
            <div className="relative w-12 h-12">
              <Image
                src={set.logoUrl}
                alt={set.setName}
                fill
                className="object-contain"
                sizes="48px"
              />
            </div>
          ) : (
            <span className="text-xl font-bold text-primary-300">
              {set.setName.charAt(0)}
            </span>
          )}
        </div>

        {/* Centre: Name & Progress */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{set.setName}</h3>
          <p className="text-xs text-stone-400 truncate">{set.series}</p>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary-400 rounded-full"
                style={{ width: `${set.completionPct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap">
              {set.ownedCount}/{set.totalCards}
              {set.totalCards > set.ownedCount ? ` · ${set.totalCards - set.ownedCount} to go` : ' · complete'}
            </span>
          </div>
        </div>

        {/* Right: Value & Chevron */}
        <div className="flex flex-col items-end gap-2 ml-4">
          <span className={`text-sm font-semibold ${set.estimatedValue > 0 ? 'text-primary-400' : 'text-stone-500'}`}>
            {set.estimatedValue > 0 ? `£${set.estimatedValue.toFixed(2)}` : '£0.00'}
          </span>
          <svg
            className={`w-5 h-5 text-stone-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Grid */}
      <div
        className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-5 bg-stone-950/30">
          {loading ? (
            /*
             * Placeholder tiles in the same 3/4/6-column grid as the real
             * cards below, so an expanded set does not resize once its cards
             * arrive. Same aspect-[5/7] and ring tokens as the real tiles.
             */
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={`set-card-skeleton-${index}`}
                  className="aspect-[63/88] animate-pulse rounded-[4.5%/3.2%] bg-stone-900 ring-1 ring-white/10"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {cards.map((card) => {
                  return (
                    <div key={card.id} className="tcg-card is-owned">
                      {card.image ? (
                        <Image
                          src={card.image}
                          alt={card.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 33vw, 16vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] text-stone-500">
                          {card.baseCardId}
                        </div>
                      )}
                      {card.variant !== 'Normal' && card.variant !== 'Unlimited' && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-1 text-[9px] text-center text-stone-300 font-medium truncate">
                          {card.variant}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 text-center">
                <Link
                  href={`/?set=${set.setId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  View in Binder
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/*
 * Loading placeholder for the collection dashboard.
 *
 * The page used to render a single vertically-centred "Loading collection..."
 * line and then swap to a top-aligned multi-section dashboard, so everything
 * on screen moved. This mirrors the real page's outer container, hero,
 * four-up stats row and set rows, using the same tokens the real sections use
 * — no new colours or spacing values.
 *
 * The 106px set rows are the real height: a w-16 h-16 logo (64) inside p-5
 * (40) plus the 1px border on each edge.
 */
function CollectionSkeleton() {
  return (
    <main className="min-h-screen bg-transparent text-stone-100 pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <section className="hero-panel">
          <div className="p-6 sm:p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-14 w-56 animate-pulse rounded bg-white/[0.06] md:h-16" />
                <div className="h-5 w-48 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
              </div>
              <div className="h-[120px] w-full flex-shrink-0 animate-pulse rounded-xl bg-white/[0.04] md:w-[400px]" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`stat-skeleton-${index}`}
              className="panel p-5 sm:p-6"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-2 h-8 w-20 animate-pulse rounded bg-white/[0.06]" />
            </div>
          ))}
        </section>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="h-7 w-32 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-5 w-20 animate-pulse rounded bg-white/[0.06]" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`set-row-skeleton-${index}`}
                  className="h-[106px] animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="h-7 w-40 animate-pulse rounded bg-white/[0.06] mx-2" />
            <div className="panel space-y-5 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`progress-skeleton-${index}`} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="h-5 w-32 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-4 w-8 animate-pulse rounded bg-white/[0.06]" />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function CollectionPage() {
  const {
    user,
    loading,
    error,
    ownedRows,
    ownedSets,
    totalValue,
    totalCards,
    grailCards,
    incompleteSets,
  } = useCollection();

  const [sortMode, setSortMode] = useState<'value' | 'completion' | 'name' | 'recent'>('value');
  const [setQuery, setSetQuery] = useState('');

  if (loading) {
    return <CollectionSkeleton />;
  }

  if (!user) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center bg-transparent p-4 text-stone-100">
        <EmptyState
          title="Sign in to see your collection"
          body="Your collection shows every card you've ticked off in the Binder, what each set is worth, and how close you are to finishing it."
          action={{ label: 'Browse the Binder', href: '/' }}
        />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100 p-8">
        <div className="max-w-7xl mx-auto rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-rose-200">
          <p>Couldn&apos;t load your collection: {error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (ownedRows.length === 0) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center bg-transparent p-4 text-stone-100">
        <EmptyState
          title="Your binder is empty"
          body="Pick a set in the Binder and tap “Add to binder” on the cards you own. Your sets, value and progress show up here."
          action={{ label: 'Open the Binder', href: '/' }}
        />
      </main>
    );
  }

  const sortedSets = [...ownedSets].sort((a, b) => {
    switch (sortMode) {
      case 'value': return b.estimatedValue - a.estimatedValue;
      case 'completion': return b.completionPct - a.completionPct;
      case 'name': return a.setName.localeCompare(b.setName);
      case 'recent': return 0; // Default order from hook is fine for now
      default: return 0;
    }
  });

  const setNeedle = setQuery.trim().toLowerCase();
  const shownSets = setNeedle
    ? sortedSets.filter(
        (set) =>
          set.setName.toLowerCase().includes(setNeedle) || set.series.toLowerCase().includes(setNeedle)
      )
    : sortedSets;

  const cardsToGo = ownedSets.reduce(
    (sum, set) => sum + Math.max(0, set.totalCards - set.ownedCount),
    0
  );
  const completeSets = ownedSets.filter((set) => set.totalCards > 0 && set.ownedCount >= set.totalCards).length;
  // The unfinished set with the fewest cards left: the easiest next win.
  const nextGoal = [...incompleteSets].sort(
    (a, b) => a.totalCards - a.ownedCount - (b.totalCards - b.ownedCount)
  )[0];

  return (
    <main className="min-h-screen bg-transparent text-stone-100 pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

        {/* SECTION 1 — Hero / Portfolio Overview */}
        <section className="hero-panel">
          <div className="p-6 sm:p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-2">
                <p className="eyebrow">
                  Portfolio Value
                </p>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                  £{totalValue.toFixed(2)}
                </h1>
                <p className="text-sm text-stone-300 pt-2">
                  across {ownedSets.length} sets · {totalCards} cards
                </p>
                <p className="text-[10px] text-stone-500 pt-1">
                  Market prices from TCGplayer, converted to GBP
                </p>
              </div>

              {nextGoal ? (
                <Link
                  href={`/?set=${nextGoal.setId}`}
                  className="group flex w-full items-center gap-5 rounded-[1.5rem] border border-primary-300/20 bg-primary-400/10 p-5 transition-colors hover:bg-primary-400/15 md:w-[360px]"
                >
                  <ProgressRing pct={nextGoal.completionPct} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary-100/75">Next goal</p>
                    <p className="mt-1 truncate font-display text-lg font-semibold text-white">{nextGoal.setName}</p>
                    <p className="text-sm text-primary-50/75">
                      {nextGoal.totalCards - nextGoal.ownedCount} cards to go · open binder →
                    </p>
                  </div>
                </Link>
              ) : null}

            </div>
          </div>
        </section>

        {/* SECTION 2 — Stats Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="panel p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Cards To Go</p>
            <p className="mt-2 text-2xl font-semibold text-white">{cardsToGo}</p>
          </div>
          <div className="panel p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Cards Owned</p>
            <p className="mt-2 text-2xl font-semibold text-white">{totalCards}</p>
          </div>
          <div className="panel p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Sets Tracked</p>
            <p className="mt-2 text-2xl font-semibold text-white">{ownedSets.length}</p>
          </div>
          <div className="panel p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Sets Complete</p>
            <p className="mt-2 text-2xl font-semibold text-white">{completeSets}</p>
          </div>
        </section>

        {/* SECTION 4 — Grail Cards */}
        {grailCards.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white px-2">Your Most Valuable Cards</h2>
            <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory hide-scrollbar">
              {grailCards.map((grail, i) => (
                <div key={`${grail.cardId}-${i}`} className="snap-start shrink-0 w-[140px] space-y-3">
                  <div className="tcg-card is-owned">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-stone-800 to-stone-950">
                      <span className="text-[10px] text-stone-400 uppercase tracking-widest">{grail.setId}</span>
                      <span className="text-xs font-bold text-stone-300 mt-1">{grail.cardId.slice(grail.cardId.lastIndexOf('-') + 1)}</span>
                    </div>
                    {/* Card art sits over the text fallback; hides itself if the image 404s. */}
                    <Image
                      src={`https://images.pokemontcg.io/${grail.setId}/${grail.cardId.slice(grail.cardId.lastIndexOf('-') + 1)}.png`}
                      alt={grail.cardId}
                      fill
                      sizes="140px"
                      className="object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="px-1">
                    <p className="text-sm font-semibold text-primary-400">£{grail.estimatedValue.toFixed(2)}</p>
                    <p className="text-xs text-stone-400 truncate mt-0.5">{grail.cardId}</p>
                    {grail.variant !== 'Normal' && grail.variant !== 'Unlimited' && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-stone-500 border border-stone-700 rounded px-1.5 py-0.5">
                        {grail.variant}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-3 gap-8 items-start">

          {/* SECTION 3 — Your Sets */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <h2 className="text-xl font-semibold text-white">Your Sets</h2>
              <div className="flex items-center gap-3">
                <input
                  type="search"
                  value={setQuery}
                  onChange={(e) => setSetQuery(e.target.value)}
                  placeholder="Find a set..."
                  aria-label="Find a set"
                  className="w-40 rounded-xl border border-white/10 bg-stone-950/80 px-3 py-2 text-sm text-white outline-none focus:border-primary-300/50 sm:w-52"
                />
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as 'value' | 'completion' | 'name' | 'recent')}
                  aria-label="Sort sets"
                  className="bg-transparent border-none text-sm text-stone-400 outline-none cursor-pointer hover:text-stone-300"
                >
                  <option value="value">Value ↓</option>
                  <option value="completion">Completion ↓</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {shownSets.map(set => (
                <SetExpandableCard key={set.setId} set={set} ownedRows={ownedRows} />
              ))}
              {shownSets.length === 0 ? (
                <p className="panel p-6 text-center text-sm text-stone-400">No sets match “{setQuery}”.</p>
              ) : null}
            </div>
          </section>

          {/* SECTION 5 — Sets In Progress */}
          {incompleteSets.length > 0 && (
            <section className="space-y-4 lg:sticky lg:top-24">
              <h2 className="text-xl font-semibold text-white px-2">Sets In Progress</h2>
              <div className="panel space-y-5 p-5">
                {incompleteSets.slice(0, 5).map(set => (
                  <div key={set.setId} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-medium text-stone-200 truncate pr-4">{set.setName}</p>
                      <p className="text-xs text-stone-400 shrink-0">{set.completionPct}%</p>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-400/80 rounded-full"
                        style={{ width: `${set.completionPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
