'use client';

import { notFound } from 'next/navigation';
import { demoMode } from '../../../lib/demo';
import { DemoBanner } from '../../components/DemoBanner';
import ListingSidebar from '../../inbox/[conversationId]/components/ListingSidebar';
import type { Conversation, Listing } from '../../inbox/[conversationId]/types';

const noop = () => undefined;

function listing(cardNumber: number, name: string, extra: Partial<Listing> = {}): Listing {
  return {
    id: `demo-listing-${cardNumber}`,
    user_id: 'them',
    card_id: `base1-${cardNumber}`,
    card_name: name,
    set_name: 'Base',
    set_id: 'base1',
    card_number: String(cardNumber),
    variant: 'Unlimited',
    condition: 'Near Mint',
    listing_type: 'either',
    price: null,
    trade_description: null,
    postcode_prefix: 'LS1',
    image_url: null,
    card_image_url: `https://images.pokemontcg.io/base1/${cardNumber}.png`,
    is_active: true,
    ...extra,
  };
}

function conversation(active: Listing): Conversation {
  return {
    id: `demo-conversation-${active.id}`,
    listing_id: active.id,
    buyer_id: 'me',
    seller_id: 'them',
    status: 'active',
    created_at: '2026-11-08T10:00:00Z',
    updated_at: '2026-11-08T10:00:00Z',
    trade_listings: [active],
  };
}

const CASES: [string, Listing, number | null][] = [
  ['Their £170 offer on a £180 card', listing(4, 'Charizard'), 170],
  ['Asking £75 for a £60 card', listing(15, 'Venusaur', { listing_type: 'sale', price: 75 }), null],
  ['A low offer of £20 on a £35 card', listing(1, 'Alakazam', { listing_type: 'trade' }), 20],
  ['Trade only, no offer yet', listing(16, 'Zapdos', { listing_type: 'trade' }), null],
];

// The trade chat's listing sidebar with the fair-trade meter, with example
// data. The real chat needs a signed-in database session. Demo only.
export default function FairTradePreviewPage() {
  if (!demoMode) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />
        <h1 className="mt-5 text-3xl font-bold text-white">Fair-trade meter in the trade chat</h1>
        <p className="mt-2 text-sm text-stone-400">You are the buyer in each chat. Example prices, not market data.</p>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {CASES.map(([label, active, offer]) => (
            <div key={label}>
              <h2 className="mb-2 text-sm font-medium text-stone-400">{label}</h2>
              <ListingSidebar
                activeListing={active}
                conversation={conversation(active)}
                userId="me"
                otherName="Sam (example)"
                onMarkListingSold={noop}
                markingSold={false}
                listingSold={false}
                latestOffer={offer}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
