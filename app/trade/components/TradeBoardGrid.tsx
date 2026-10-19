'use client';

import type { TradeListing } from '../types';
import { classNames } from '../utils';
import { TradeListingCard } from './TradeListingCard';

type Props = {
  loading: boolean;
  listings: TradeListing[];
  nowMs: number | null;
  userId: string | null;
  hasUser: boolean;
  interestedIds: Set<string>;
  conversationByListingId: Record<string, string>;
  manageOpenFor: string | null;
  pendingInterestId: string | null;
  pendingManageId: string | null;
  onToggleManage: (listingId: string) => void;
  onExpressInterest: (listingId: string) => void;
  onMarkSold: (listingId: string) => void;
  onDeleteListing: (listingId: string) => void;
  onOpenModal: () => void;
};

export function TradeBoardGrid({
  loading,
  listings,
  nowMs,
  userId,
  hasUser,
  interestedIds,
  conversationByListingId,
  manageOpenFor,
  pendingInterestId,
  pendingManageId,
  onToggleManage,
  onExpressInterest,
  onMarkSold,
  onDeleteListing,
  onOpenModal,
}: Props) {
  return (
    <section className="mt-6">
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="animate-pulse overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04]"
            >
              <div className="aspect-[3/4] bg-white/[0.06]" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-24 rounded bg-white/[0.06]" />
                <div className="h-4 w-4/5 rounded bg-white/[0.06]" />
                <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                <div className="h-8 w-full rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur">
          <div className="text-5xl">🃏</div>
          <h2 className="text-2xl font-semibold text-white">No listings found</h2>
          <p className="text-sm text-stone-400">Be the first to list a card.</p>
          <button
            type="button"
            onClick={onOpenModal}
            disabled={!hasUser}
            className={classNames(
              'mt-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-colors',
              hasUser
                ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                : 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
            )}
          >
            List a Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <TradeListingCard
              key={listing.id}
              listing={listing}
              nowMs={nowMs}
              hasUser={hasUser}
              isOwner={Boolean(userId && userId === listing.user_id)}
              interested={interestedIds.has(listing.id)}
              conversationId={conversationByListingId[listing.id] ?? null}
              manageOpen={manageOpenFor === listing.id}
              interestPending={pendingInterestId === listing.id}
              managePending={pendingManageId === listing.id}
              onToggleManage={() => onToggleManage(listing.id)}
              onMarkSold={() => onMarkSold(listing.id)}
              onDeleteListing={() => onDeleteListing(listing.id)}
              onExpressInterest={() => onExpressInterest(listing.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
