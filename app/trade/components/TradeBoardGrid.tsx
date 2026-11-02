'use client';

import type { TradeListing } from '../types';
import { EmptyState } from '../../components/EmptyState';
import { TradeListingCard } from './TradeListingCard';

type Props = {
  loading: boolean;
  listings: TradeListing[];
  wishlistIds: Set<string>;
  filtersActive: boolean;
  onClearFilters: () => void;
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
  wishlistIds,
  filtersActive,
  onClearFilters,
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
              className="panel animate-pulse overflow-hidden"
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
        filtersActive ? (
          <EmptyState
            title="Nothing matches those filters"
            body="Try a wider postcode, another set, or clear the filters to see every listing."
            action={{ label: 'Clear filters', onClick: onClearFilters }}
          />
        ) : (
          <EmptyState
            title="The board is empty"
            body={
              hasUser
                ? 'List a spare card for trade or sale and it shows up here for collectors near you.'
                : 'Sign in to list a spare card for trade or sale.'
            }
            action={{ label: 'List a card', onClick: onOpenModal, disabled: !hasUser }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <TradeListingCard
              key={listing.id}
              listing={listing}
              onWishlist={wishlistIds.has(listing.card_id)}
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
