'use client';

import { useAuth } from '../auth';
import { ListingModal } from './components/ListingModal';
import { TradeBoardGrid } from './components/TradeBoardGrid';
import { TradeBoardHeader } from './components/TradeBoardHeader';
import { TradeFilterBar } from './components/TradeFilterBar';
import { useListingForm } from './hooks/useListingForm';
import { useTradeFilters } from './hooks/useTradeFilters';
import { useTradeListings } from './hooks/useTradeListings';

export default function TradeBoardPage() {
  const { user, authLoading } = useAuth();
  const board = useTradeListings();
  const filters = useTradeFilters({ listings: board.listings });
  const form = useListingForm({ onListingCreated: board.addListing });

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TradeBoardHeader
          stats={board.stats}
          hasUser={Boolean(user)}
          authLoading={authLoading}
          onOpenModal={form.openModal}
        />

        {!user && !authLoading ? (
          <div className="mt-4 rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-4 text-center text-sm text-amber-200/80">
            Sign in to list cards and express interest in trades
          </div>
        ) : null}

        <TradeFilterBar filters={filters} setOptions={board.setOptions} />

        {board.error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">
            {board.error}
          </div>
        ) : null}

        <TradeBoardGrid
          loading={board.loading}
          listings={filters.filteredListings}
          nowMs={board.nowMs}
          userId={user?.id ?? null}
          hasUser={Boolean(user)}
          interestedIds={board.interestedIds}
          conversationByListingId={board.conversationByListingId}
          manageOpenFor={board.manageOpenFor}
          onToggleManage={(listingId) =>
            board.setManageOpenFor((current) => (current === listingId ? null : listingId))
          }
          onExpressInterest={board.handleExpressInterest}
          onMarkSold={board.handleMarkSold}
          onDeleteListing={board.handleDeleteListing}
          onOpenModal={form.openModal}
        />

        <ListingModal form={form} />
      </div>
    </main>
  );
}
