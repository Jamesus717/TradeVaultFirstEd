'use client';

import { BinderGrid } from './binder/BinderGrid';
import { MissingCards } from './binder/MissingCards';
import { SetPicker } from './binder/SetPicker';
import { useBinder } from './binder/useBinder';
import type { SortMode } from './binder/types';

export default function Page() {
  const {
    user,
    groupedSets,
    selectedSet,
    selectedSetId,
    setSelectedSetId,
    owned,
    searchQuery,
    setSearchQuery,
    sortMode,
    setSortMode,
    visibleCards,
    missingCards,
    binderSummary,
    loadingSets,
    isLoading,
    error,
    cards,
    total,
    ownedCount,
    completion,
    allOwned,
    savingId,
    bulkSaving,
    toggleOwned,
    toggleAllOwned,
  } = useBinder();

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
                    Pokemon TCG Master Set Tracker
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                    TradeBinder
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
                    Track Normal and Reverse Holo variants across multiple eras and
                    sets, with reverse holo variants generated in code only.
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
                <div className="min-w-[240px] rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-100/75">
                    Collection Progress
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {ownedCount} / {total || '--'}
                  </p>
                  <p className="mt-1 text-sm text-emerald-50/75">{completion}% complete</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-stone-300">
            Loading set data...
          </section>
        ) : error ? (
          <section className="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-10 text-center text-rose-100">
            {error}
          </section>
        ) : (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300/80">
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
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      !user || bulkSaving || cards.length === 0
                        ? 'cursor-not-allowed bg-stone-800 text-stone-400'
                        : allOwned
                          ? 'bg-rose-400 text-rose-950 hover:bg-rose-300'
                          : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                    }`}
                  >
                    {bulkSaving ? 'Saving...' : allOwned ? 'Unmark all as owned' : 'Mark all as owned'}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search card name..."
                    className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                  />
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="binder">Binder order (Number ↑)</option>
                    <option value="number-desc">Number ↓</option>
                    <option value="name-asc">Name A → Z</option>
                    <option value="owned-first">Owned first</option>
                  </select>
                </div>
                <p className="mt-1 text-sm text-stone-400">
                  {binderSummary}
                </p>
              </div>

              <BinderGrid
                cards={visibleCards}
                owned={owned}
                savingId={savingId}
                bulkSaving={bulkSaving}
                canEdit={Boolean(user)}
                onToggleOwned={toggleOwned}
              />
            </section>

            <MissingCards
              missingCards={missingCards}
              selectedSetName={selectedSet?.name ?? 'this set'}
            />
          </div>
        )}
      </div>
    </main>
  );
}
