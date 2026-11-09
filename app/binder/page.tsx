'use client';

import { useState } from 'react';
import { BinderGrid } from './BinderGrid';
import { BinderGridSkeleton } from './BinderGridSkeleton';
import { EmptyState } from '../components/EmptyState';
import { MissingCards } from './MissingCards';
import { SetPicker } from './SetPicker';
import { useBinder } from './useBinder';
import { CardDetailModal } from './components/CardDetailModal';
import { BinderFiltersBar } from './components/BinderFilters';
import { BinderSortControl } from './components/BinderSort';
import { BinderCsv } from './components/BinderCsv';
import { SetProgressCard } from './components/SetProgressCard';
import { QuickAdd } from './components/QuickAdd';
import type { CardVariant } from './types';

export default function Page() {
  const [selectedCard, setSelectedCard] = useState<CardVariant | null>(null);

  const {
    user,
    groupedSets,
    selectedSet,
    selectedSetId,
    setSelectedSetId,
    owned,
    setSearchQuery,
    sortMode,
    setSortMode,
    sortAvailable,
    visibleCards,
    missingCards,
    binderSummary,
    loadingSets,
    isLoading,
    error,
    cards,
    total,
    ownedCount,
    allOwned,
    savingId,
    bulkSaving,
    toggleOwned,
    toggleAllOwned,
    noteOwned,
    filters,
    setFilters,
    clearFilters,
    available,
    activeFilters,
  } = useBinder();

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="hero-panel">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="eyebrow">
                    Your digital binder
                  </p>
                  <h1 className="text-4xl font-bold text-white sm:text-6xl">
                    TradeBinder
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
                    Tick off every card you own, set by set. See what&apos;s missing,
                    what it&apos;s worth, and trade the rest safely at a local shop.
                  </p>
                </div>

                <div className="max-w-xl">
                  <SetPicker
                    groupedSets={groupedSets}
                    selectedSetId={selectedSetId}
                    onChange={setSelectedSetId}
                    disabled={loadingSets || Object.keys(groupedSets).length === 0}
                    selectedSetLabel={
                      selectedSet
                        ? `${selectedSet.series} · ${selectedSet.releaseDate}`
                        : 'Choose a set to load cards.'
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:items-end">
                <SetProgressCard
                  setId={selectedSetId}
                  owned={ownedCount}
                  total={total}
                  onShowMissing={setFilters}
                />
              </div>
            </div>
          </div>
        </section>

        <BinderCsv />

        {isLoading ? (
          <BinderGridSkeleton />
        ) : error ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-10 text-center text-rose-100">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300"
            >
              Try again
            </button>
          </section>
        ) : (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="panel p-5">
                <p className="text-xs font-semibold text-primary-300/80">
                  Set Binder
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-semibold text-white">
                    {selectedSet?.name ?? 'Selected Set'}
                  </h2>
                  <button
                    type="button"
                    onClick={toggleAllOwned}
                    disabled={!user || bulkSaving || cards.length === 0}
                    className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      !user || bulkSaving || cards.length === 0
                        ? 'cursor-not-allowed bg-stone-800 text-stone-400'
                        : allOwned
                          ? 'bg-rose-400 text-rose-950 hover:bg-rose-300'
                          : 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                    }`}
                  >
                    {bulkSaving ? 'Saving...' : allOwned ? 'Unmark all as owned' : 'Mark all as owned'}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="search"
                    value={filters.q}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search card name..."
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-stone-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-300/50"
                  />
                  <BinderSortControl value={sortMode} onChange={setSortMode} available={sortAvailable} />
                </div>

                <BinderFiltersBar
                  filters={filters}
                  onChange={setFilters}
                  onClear={clearFilters}
                  activeCount={activeFilters}
                  available={available}
                />

                <p className="mt-3 text-sm text-stone-400" aria-live="polite">
                  {binderSummary}
                </p>
              </div>

              {ownedCount === 0 && cards.length > 0 && activeFilters === 0 ? (
                <EmptyState
                  compact
                  title="Your binder is empty"
                  body={
                    user
                      ? 'Tap a card below to mark it as owned. Start with one you have in your hands.'
                      : 'Sign in to save the cards you own. You can still look around the set.'
                  }
                />
              ) : null}

              <BinderGrid
                cards={visibleCards}
                onClearFilters={activeFilters > 0 ? clearFilters : undefined}
                owned={owned}
                savingId={savingId}
                bulkSaving={bulkSaving}
                canEdit={Boolean(user)}
                onToggleOwned={toggleOwned}
                onCardClick={setSelectedCard}
              />
            </section>

            <MissingCards
              missingCards={missingCards}
              selectedSetName={selectedSet?.name ?? 'this set'}
            />
          </div>
        )}
      </div>

      <QuickAdd onOwned={noteOwned} />

      <CardDetailModal 
        card={selectedCard} 
        isOpen={selectedCard !== null} 
        onClose={() => setSelectedCard(null)} 
        isOwned={selectedCard ? (owned[selectedCard.id] ?? false) : false} 
        onToggleOwned={() => selectedCard && toggleOwned(selectedCard)} 
        isSaving={selectedCard ? savingId === selectedCard.id : false} 
      />
    </main>
  );
}
