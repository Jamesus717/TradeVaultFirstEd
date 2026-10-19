'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Conversation, Listing } from '../types';
import { classNames, statusBadge } from '../utils';

export default function ConversationHeader({
  conversation,
  activeListing,
}: {
  conversation: Conversation | null;
  activeListing: Listing | null;
}) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <Link href="/inbox" className="text-sm font-medium text-stone-300 hover:text-white">
        ← Back
      </Link>
      <div className="h-10 w-10 overflow-hidden rounded-lg bg-stone-900 ring-1 ring-white/5">
        {activeListing?.image_url || activeListing?.card_image_url ? (
          <Image
            src={activeListing?.image_url ?? activeListing?.card_image_url ?? ''}
            alt={activeListing?.card_name ?? 'Listing'}
            width={80}
            height={112}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-stone-600">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {activeListing?.card_name ?? 'Conversation'}
        </p>
        <p className="truncate text-xs text-stone-400">
          {activeListing?.set_name ?? 'Unknown set'} · #{activeListing?.card_number ?? '--'}
        </p>
      </div>
      {conversation ? (
        <span
          className={classNames(
            'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
            statusBadge(conversation.status).className
          )}
        >
          {statusBadge(conversation.status).label}
        </span>
      ) : null}
    </div>
  );
}
