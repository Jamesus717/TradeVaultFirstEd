'use client';

import { useState } from 'react';
import type { Shop } from '../../../../lib/shops';

export type MeetState = {
  meet_shop_id: string | null;
  meet_at: string | null;
  meet_proposed_by: string | null;
  meet_status: 'none' | 'proposed' | 'agreed' | 'declined';
};

type Props = {
  meet: MeetState;
  shops: Shop[];
  userId: string;
  otherName: string;
  pending: boolean;
  error: string;
  onPropose: (shopId: string, meetAt: string | null) => void;
  onRespond: (agree: boolean) => void;
};

function formatWhen(value: string | null) {
  return value
    ? new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
}

export function MeetPanel({ meet, shops, userId, otherName, pending, error, onPropose, onRespond }: Props) {
  const [choosing, setChoosing] = useState(false);
  const [shopId, setShopId] = useState('');
  const [when, setWhen] = useState('');

  const shop = shops.find((entry) => entry.id === meet.meet_shop_id);
  const shopName = shop?.name ?? 'the shop';
  const whenLabel = formatWhen(meet.meet_at);
  const place = whenLabel ? `${shopName}, ${whenLabel}` : shopName;
  const mine = meet.meet_proposed_by === userId;

  const showForm = choosing || meet.meet_status === 'none' || meet.meet_status === 'declined';

  return (
    <section aria-label="Meet at a shop" className="panel mb-4 space-y-3 p-4">
      {meet.meet_status === 'agreed' ? (
        <p className="text-sm text-stone-100">
          <span className="font-semibold text-primary-200">Meeting agreed:</span> {place}
        </p>
      ) : meet.meet_status === 'proposed' ? (
        <p className="text-sm text-stone-100">
          {mine ? `Waiting for ${otherName} to answer: ` : `${otherName} suggested `}
          {place}
        </p>
      ) : (
        <p className="text-sm text-stone-200">
          {meet.meet_status === 'declined' ? `${shopName} didn't suit. Suggest another shop.` : 'Swap at a shop with staff around.'}
        </p>
      )}

      {meet.meet_status === 'proposed' && !mine ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onRespond(true)}
            className="min-h-11 flex-1 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:opacity-60"
          >
            Agree
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onRespond(false)}
            className="min-h-11 flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-stone-100 hover:bg-white/[0.06] disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onPropose(shopId, when ? new Date(when).toISOString() : null);
            setChoosing(false);
          }}
        >
          <select
            value={shopId}
            onChange={(event) => setShopId(event.target.value)}
            aria-label="Shop"
            className="min-h-11 rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-base text-white sm:text-sm"
          >
            <option value="">Choose a shop</option>
            {shops.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            aria-label="Time (optional)"
            className="min-h-11 rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-base text-white sm:text-sm"
          />
          <button
            type="submit"
            disabled={!shopId || pending}
            className="min-h-11 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-400"
          >
            {pending ? 'Sending...' : 'Suggest shop'}
          </button>
        </form>
      ) : meet.meet_status !== 'none' ? (
        <button type="button" onClick={() => setChoosing(true)} className="inline-flex min-h-11 items-center text-sm text-stone-400 underline-offset-4 hover:text-white hover:underline">
          Suggest a different shop
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
