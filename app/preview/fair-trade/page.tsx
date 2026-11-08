'use client';

import { notFound } from 'next/navigation';
import { encodeCardOffer, type CardOffer } from '../../../lib/cardOffer';
import { demoMode } from '../../../lib/demo';
import type { Deal } from '../../../lib/fairTrade';
import { DemoBanner } from '../../components/DemoBanner';
import CardOfferPanel from '../../inbox/[conversationId]/components/CardOfferPanel';
import ListingSidebar from '../../inbox/[conversationId]/components/ListingSidebar';
import MessageItem from '../../inbox/[conversationId]/components/MessageItem';
import { useMyCards } from '../../inbox/[conversationId]/hooks/useMyCards';
import type { Conversation, Listing, Message } from '../../inbox/[conversationId]/types';

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

const cash = (amount: number): Deal => ({ kind: 'cash', amount, senderId: 'me' });
const cards = (offer: CardOffer, senderId = 'me'): Deal => ({ kind: 'cards', offer, senderId });

const SWAP: CardOffer = {
  cards: [
    { id: 'base1-2', name: 'Blastoise', variant: 'Normal' },
    { id: 'base1-7', name: 'Hitmonchan', variant: 'Normal' },
  ],
  cash: 50,
};

const CASES: [string, Listing, Deal | null][] = [
  ['Their £170 offer on a £180 card', listing(4, 'Charizard'), cash(170)],
  ['Asking £75 for a £60 card', listing(15, 'Venusaur', { listing_type: 'sale', price: 75 }), null],
  ['A low offer of £20 on a £35 card', listing(1, 'Alakazam', { listing_type: 'trade' }), cash(20)],
  ['Trade only, no offer yet', listing(16, 'Zapdos', { listing_type: 'trade' }), null],
  ['Two cards and £50 for Charizard', listing(4, 'Charizard', { listing_type: 'trade' }), cards(SWAP)],
  [
    'Reverse holo for a Pikachu',
    listing(58, 'Pikachu', { listing_type: 'trade' }),
    cards({ cards: [{ id: 'sv3pt5-25', name: 'Pikachu', variant: 'Reverse Holo' }], cash: null }),
  ],
  [
    'A card with no price yet',
    listing(20, 'Electabuzz', { listing_type: 'trade' }),
    cards({ cards: [{ id: 'base1-8', name: 'Machamp', variant: 'Normal' }], cash: null }),
  ],
  [
    'Part priced: Electabuzz has no price',
    listing(15, 'Venusaur', { listing_type: 'trade' }),
    cards({
      cards: [
        { id: 'base1-20', name: 'Electabuzz', variant: 'Normal' },
        { id: 'base1-7', name: 'Hitmonchan', variant: 'Normal' },
      ],
      cash: null,
    }),
  ],
];

const OFFER_MESSAGE: Message = {
  id: 'demo-card-offer',
  conversation_id: 'demo-conversation',
  sender_id: 'me',
  content: encodeCardOffer(SWAP),
  message_type: 'message',
  offer_amount: null,
  offer_status: null,
  created_at: '2026-11-08T10:00:00Z',
  read_at: null,
};

// The trade chat's listing sidebar with the fair-trade meter, and the "Offer
// cards" picker, with example data. The real chat needs a signed-in database
// session. Demo only.
export default function FairTradePreviewPage() {
  const myCards = useMyCards('me', true);

  if (!demoMode) {
    notFound();
  }

  const charizard = listing(4, 'Charizard', { listing_type: 'trade' });

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />
        <h1 className="mt-5 text-3xl font-bold text-white">Fair-trade meter in the trade chat</h1>
        <p className="mt-2 text-sm text-stone-400">You are the buyer in each chat. Example prices, not market data.</p>

        <h2 className="mt-8 text-lg font-semibold text-white">Offer cards from your collection</h2>
        <p className="mt-1 text-sm text-stone-400">
          Pick cards and the meter compares both sides before you send. This is what the buyer sees in the chat for
          Sam&apos;s Charizard.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="space-y-3 p-5">
              <MessageItem
                message={OFFER_MESSAGE}
                userId="me"
                otherName="Sam (example)"
                onOfferDecision={noop}
                onCounterOffer={noop}
                offerDecisionPending={null}
              />
            </div>
            <div className="border-t border-white/10 p-4">
              <CardOfferPanel
                cards={myCards.cards}
                loading={myCards.loading}
                loadError={myCards.error}
                listing={charizard}
                userId="me"
                sellerId="them"
                sending={false}
                sendError=""
                onSend={noop}
                onCancel={noop}
                initialPicked={['base1-2|Normal', 'base1-7|Normal']}
                initialCash="50"
              />
            </div>
          </section>
          <ListingSidebar
            activeListing={charizard}
            conversation={conversation(charizard)}
            userId="me"
            otherName="Sam (example)"
            onMarkListingSold={noop}
            markingSold={false}
            listingSold={false}
            deal={cards(SWAP)}
          />
        </div>

        <h2 className="mt-10 text-lg font-semibold text-white">Every state of the meter</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {CASES.map(([label, active, deal]) => (
            <div key={label}>
              <h3 className="mb-2 text-sm font-medium text-stone-400">{label}</h3>
              <ListingSidebar
                activeListing={active}
                conversation={conversation(active)}
                userId="me"
                otherName="Sam (example)"
                onMarkListingSold={noop}
                markingSold={false}
                listingSold={false}
                deal={deal}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
