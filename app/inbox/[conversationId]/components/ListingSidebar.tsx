'use client';

import Image from 'next/image';
import type { Conversation, Listing } from '../types';
import { classNames, conditionBadgeClass, formatMoneyGBP, listingTypeBadge } from '../utils';

export default function ListingSidebar({
  activeListing,
  conversation,
  userId,
  otherName,
  onMarkListingSold,
  markingSold,
  listingSold,
}: {
  activeListing: Listing | null;
  conversation: Conversation;
  userId: string;
  otherName: string;
  onMarkListingSold: () => void;
  markingSold: boolean;
  listingSold: boolean;
}) {
  return (
    <aside className="h-fit space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Listing</p>
      <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-stone-900">
        <div className="relative aspect-[3/4]">
          {activeListing?.image_url || activeListing?.card_image_url ? (
            <Image
              src={activeListing?.image_url ?? activeListing?.card_image_url ?? ''}
              alt={activeListing?.card_name ?? 'Listing'}
              fill
              sizes="320px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-stone-600">
              No image
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-base font-semibold text-white">{activeListing?.card_name}</p>
        <p className="text-xs text-stone-400">
          {activeListing?.set_name} · #{activeListing?.card_number} · {activeListing?.variant}
        </p>
      </div>

      {activeListing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={classNames(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
              conditionBadgeClass(activeListing.condition)
            )}
          >
            {activeListing.condition}
          </span>
          <span
            className={classNames(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
              listingTypeBadge(activeListing.listing_type).className
            )}
          >
            {listingTypeBadge(activeListing.listing_type).label}
          </span>
        </div>
      ) : null}

      {activeListing?.listing_type !== 'trade' && activeListing?.price ? (
        <p className="text-lg font-semibold text-primary-400">
          {formatMoneyGBP(activeListing.price)}
        </p>
      ) : null}

      {activeListing?.trade_description ? (
        <p className="text-sm text-stone-300">{activeListing.trade_description}</p>
      ) : null}

      {activeListing?.postcode_prefix ? (
        <p className="text-xs text-stone-400">
          <span className="mr-1">📍</span>
          {activeListing.postcode_prefix} area
        </p>
      ) : null}

      <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Seller</p>
        <p className="mt-2 text-sm text-stone-200">
          {conversation.seller_id === userId ? 'You' : otherName}
        </p>
      </div>

      {activeListing?.user_id === userId ? (
        <button
          type="button"
          onClick={onMarkListingSold}
          disabled={markingSold || listingSold}
          className={classNames(
            'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-stone-100 hover:bg-white/[0.06]',
            markingSold || listingSold ? 'cursor-not-allowed opacity-60' : ''
          )}
        >
          {listingSold ? 'Marked as Sold' : markingSold ? 'Marking…' : 'Mark as Sold'}
        </button>
      ) : null}
    </aside>
  );
}
