'use client';

import Image from 'next/image';
import type { TradeListing } from '../types';
import { classNames, conditionBadgeClass, formatMoneyGBP, formatTimeAgo, listingTypeBadge } from '../utils';

type Props = {
  listing: TradeListing;
  nowMs: number | null;
  hasUser: boolean;
  isOwner: boolean;
  interested: boolean;
  conversationId: string | null;
  manageOpen: boolean;
  interestPending: boolean;
  managePending: boolean;
  onToggleManage: () => void;
  onMarkSold: () => void;
  onDeleteListing: () => void;
  onExpressInterest: () => void;
};

export function TradeListingCard({
  listing,
  nowMs,
  hasUser,
  isOwner,
  interested,
  conversationId,
  manageOpen,
  interestPending,
  managePending,
  onToggleManage,
  onMarkSold,
  onDeleteListing,
  onExpressInterest,
}: Props) {
  const image = listing.image_url || listing.card_image_url || '';
  const typeBadge = listingTypeBadge(listing.listing_type);
  const showOpenChat = Boolean(conversationId) || interested;
  const sellerInitial = (listing.user_id[0] ?? '?').toUpperCase();

  return (
    <article
      /*
       * transition-colors, not transition-all: border-color and
       * background-color are the only things this card's hover changes, so the
       * rendered result is identical while the browser stops diffing every
       * animatable property on each style recalculation of every card.
       */
      className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="relative aspect-[3/4] bg-stone-900">
        {image ? (
          <Image
            src={image}
            alt={listing.card_name}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-stone-600">
            No image
          </div>
        )}

        <div className="absolute left-0 top-0 flex w-full items-start justify-between p-2">
          <div
            className={classNames(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
              conditionBadgeClass(listing.condition)
            )}
          >
            {listing.condition}
          </div>
          <div
            className={classNames(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
              typeBadge.className
            )}
          >
            {typeBadge.label}
          </div>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
          {listing.set_name}
        </p>
        <h3 className="text-base font-semibold text-white leading-tight">
          {listing.card_name}
        </h3>
        <p className="text-xs text-stone-400">
          #{listing.card_number} · {listing.variant}
        </p>

        {listing.listing_type === 'trade' ? (
          <p className="line-clamp-1 text-sm italic text-stone-300">
            {listing.trade_description ?? 'Open to offers'}
          </p>
        ) : listing.listing_type === 'sale' ? (
          <p className="text-lg font-semibold text-primary-400">
            {listing.price ? formatMoneyGBP(listing.price) : 'Price on request'}
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold text-primary-400">
              {listing.price ? formatMoneyGBP(listing.price) : 'Price on request'}
            </p>
            {listing.trade_description ? (
              <p className="line-clamp-1 text-sm italic text-stone-300">
                {listing.trade_description}
              </p>
            ) : null}
          </div>
        )}

        {listing.postcode_prefix ? (
          <p className="text-xs text-stone-400">
            <span className="mr-1">📍</span>
            {listing.postcode_prefix} area
          </p>
        ) : null}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-400/30 bg-primary-400/20 text-xs font-semibold text-primary-300">
              {sellerInitial}
            </div>
            <p className="text-xs text-stone-400">{formatTimeAgo(listing.created_at, nowMs)}</p>
          </div>

          {isOwner ? (
            <div className="relative">
              <button
                type="button"
                onClick={onToggleManage}
                className="rounded-xl bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-100 transition-colors hover:bg-white/[0.08]"
              >
                Manage
              </button>
              {manageOpen ? (
                <div className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-2xl border border-white/10 bg-stone-950/95 shadow-2xl shadow-black/30 backdrop-blur">
                  <button
                    type="button"
                    onClick={onMarkSold}
                    disabled={managePending}
                    className={classNames(
                      'w-full px-4 py-3 text-left text-sm text-stone-200 hover:bg-white/[0.06]',
                      managePending ? 'cursor-not-allowed opacity-60' : ''
                    )}
                  >
                    {managePending ? 'Working…' : 'Mark as sold'}
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteListing}
                    disabled={managePending}
                    className={classNames(
                      'w-full px-4 py-3 text-left text-sm text-rose-200 hover:bg-white/[0.06]',
                      managePending ? 'cursor-not-allowed opacity-60' : ''
                    )}
                  >
                    Delete listing
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={onExpressInterest}
              disabled={!hasUser || interestPending}
              className={classNames(
                'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                showOpenChat
                  ? 'bg-primary-400/20 text-primary-200 hover:bg-primary-400/30'
                  : 'bg-stone-800 text-stone-100 hover:bg-primary-400 hover:text-primary-950',
                !hasUser || interestPending ? 'cursor-not-allowed opacity-60' : ''
              )}
            >
              {interestPending ? 'Opening…' : showOpenChat ? 'Open Chat' : "I'm Interested"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
