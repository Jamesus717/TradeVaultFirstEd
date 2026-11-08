// Example data for `npm run demo`. The new tables are not on production yet, so
// this is the only way to see the matching and shop pages. Nothing here is real:
// the traders and shops are made up, and every demo page says so.

import type { TradeListing } from '../app/trade/types';
import type { MatchRow } from './matching';
import type { Shop } from './shops';
import type { Conversation, Message, PublicProfile } from '../app/inbox/[conversationId]/types';

export const demoMode = process.env.NEXT_PUBLIC_TB_DEMO === '1';

function shop(id: string, name: string, town: string, description: string): Shop {
  return {
    id,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    description,
    address: `1 Example Street, ${town}`,
    town,
    website: null,
    opening_hours: 'Example hours: Tue to Sat, 10 to 6',
    games: ['pokemon'],
    featured_until: null,
  };
}

export const DEMO_SHOPS: Shop[] = [
  {
    ...shop('demo-1', 'Example Cards Leeds', 'Leeds', 'Example shop. Trade tables at the back and a noticeboard for meets.'),
    featured_until: '2099-01-01T00:00:00Z',
  },
  shop('demo-2', 'Sample Games York', 'York', 'Example shop. League night on Thursdays.'),
  shop('demo-3', 'Placeholder TCG Sheffield', 'Sheffield', 'Example shop. Binder swaps every Saturday.'),
];

function row(
  trader: [string, string],
  direction: MatchRow['direction'],
  number: number,
  name: string,
  extra: Partial<MatchRow> = {}
): MatchRow {
  return {
    trader_id: trader[0],
    username: trader[1],
    display_name: trader[1],
    direction,
    item_id: `${trader[0]}-${direction}-${number}`,
    card_id: `base1-${number}`,
    set_id: 'base1',
    card_name: name,
    set_name: 'Base',
    card_number: String(number),
    image_url: `https://images.pokemontcg.io/base1/${number}.png`,
    variant: 'Normal',
    condition: 'NM',
    tradable: 1,
    is_spare: false,
    want_priority: 'medium',
    ...extra,
  };
}

const sam: [string, string] = ['demo-sam', 'Sam (example)'];
const robin: [string, string] = ['demo-robin', 'Robin (example)'];
const alex: [string, string] = ['demo-alex', 'Alex (example)'];
const jo: [string, string] = ['demo-jo', 'Jo (example)'];

export const DEMO_MATCHES: MatchRow[] = [
  row(robin, 'they_have', 15, 'Venusaur', { condition: null }),
  row(sam, 'they_have', 4, 'Charizard', { want_priority: 'high', condition: 'LP' }),
  row(sam, 'they_have', 58, 'Pikachu'),
  row(sam, 'i_have', 2, 'Blastoise', { is_spare: true }),
  row(alex, 'they_have', 16, 'Zapdos'),
  row(alex, 'i_have', 10, 'Mewtwo', { condition: 'MP' }),
  row(robin, 'i_have', 8, 'Machamp', { is_spare: true }),
  row(robin, 'i_have', 7, 'Hitmonchan'),
  // Jo has match requests turned off, so the demo shows the hidden button.
  row(jo, 'they_have', 1, 'Alakazam', { accepts_requests: false }),
];

// Which shop each example trader uses, so the home shop chips filter.
const DEMO_TRADER_SHOPS: Record<string, string> = {
  'demo-sam': 'demo-1',
  'demo-robin': 'demo-1',
  'demo-alex': 'demo-2',
  'demo-jo': 'demo-3',
};

// The demo user has used today's free allowance, so "Start trade" shows the
// limit message the database raises.
export const DEMO_ALLOWANCE = { daily_limit: 10, used: 10, resets_in_hours: 5 };
export const DEMO_LIMIT_MESSAGE = `Daily match limit reached, resets in ${DEMO_ALLOWANCE.resets_in_hours} h`;
export const DEMO_UNREAD_MESSAGES = 2;
export const DEMO_ME = 'demo-me';

export function demoMatches(shopId: string) {
  return shopId ? DEMO_MATCHES.filter((match) => DEMO_TRADER_SHOPS[match.trader_id] === shopId) : DEMO_MATCHES;
}

function listing(
  trader: [string, string],
  number: number,
  name: string,
  hoursAgo: number,
  nowMs: number,
  extra: Partial<TradeListing> = {}
): TradeListing {
  return {
    id: `${trader[0]}-listing-${number}`,
    user_id: trader[1],
    card_id: `base1-${number}`,
    card_name: name,
    set_name: 'Base',
    set_id: 'base1',
    card_number: String(number),
    variant: 'Unlimited',
    condition: 'Near Mint',
    listing_type: 'trade',
    // No made-up prices: a sale listing reads "Price on request".
    price: null,
    trade_description: 'Example: open to Base set holos',
    image_url: null,
    card_image_url: `https://images.pokemontcg.io/base1/${number}.png`,
    created_at: new Date(nowMs - hoursAgo * 3_600_000).toISOString(),
    is_active: true,
    ...extra,
  };
}

export function demoListings(nowMs: number): TradeListing[] {
  return [
    listing(sam, 4, 'Charizard', 1, nowMs, { condition: 'Lightly Played', listing_type: 'either' }),
    listing(alex, 16, 'Zapdos', 3, nowMs),
    listing(robin, 15, 'Venusaur', 5, nowMs, { listing_type: 'sale', trade_description: null }),
    listing(jo, 1, 'Alakazam', 8, nowMs, { condition: 'Moderately Played' }),
    listing(sam, 58, 'Pikachu', 26, nowMs, { variant: 'Normal', trade_description: null }),
    listing(alex, 10, 'Mewtwo', 30, nowMs, { condition: 'Moderately Played', listing_type: 'sale', trade_description: null }),
    listing(robin, 8, 'Machamp', 50, nowMs, { variant: '1st Edition' }),
    listing(jo, 2, 'Blastoise', 72, nowMs, { condition: 'Heavily Played', listing_type: 'either' }),
  ];
}

// Listings a shop has, derived the same way so the board's shop filter works too.
export function demoShopByListing(listings: TradeListing[]) {
  const traderByName = new Map([sam, robin, alex, jo].map(([id, name]) => [name, id]));
  return Object.fromEntries(
    listings.map((entry) => [entry.id, DEMO_TRADER_SHOPS[traderByName.get(entry.user_id) ?? '']])
  );
}

// Stable ids for the detail pages, so /inbox/demo-chat-1, /profile/demo-sam,
// /shops/example-cards-leeds and /u/sam always render in `npm run demo`.
export type DemoProfile = {
  user_id: string;
  username: string;
  display_name: string;
  profile_slug: string;
  bio: string;
  created_at: string;
};

export const DEMO_PROFILES: DemoProfile[] = [sam, alex, robin, jo].map(([id, name]) => ({
  user_id: id,
  username: id.replace('demo-', ''),
  display_name: name,
  profile_slug: id.replace('demo-', ''),
  bio: 'Example trader. Made up for the demo.',
  created_at: '2026-01-15T10:00:00Z',
}));

export function demoProfileByUserId(userId: string) {
  return DEMO_PROFILES.find((profile) => profile.user_id === userId) ?? null;
}

export function demoProfileBySlug(slug: string) {
  return DEMO_PROFILES.find((profile) => profile.profile_slug === slug) ?? null;
}

const DEMO_CHATS = [
  { id: 'demo-chat-1', other: 'demo-sam', number: 4, name: 'Charizard', status: 'active', line: 'Example: Saturday at Example Cards Leeds works for me' },
  { id: 'demo-chat-2', other: 'demo-alex', number: 16, name: 'Zapdos', status: 'active', line: 'Example: would you add the Mewtwo?' },
  { id: 'demo-chat-3', other: 'demo-robin', number: 15, name: 'Venusaur', status: 'accepted', line: 'Example: deal, see you there' },
] as const;

export const DEMO_CONVERSATION_IDS: string[] = DEMO_CHATS.map((chat) => chat.id);

export function demoConversation(id: string, nowMs: number) {
  const chat = DEMO_CHATS.find((entry) => entry.id === id);
  if (!chat) {
    return null;
  }
  const at = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();
  const conversation: Conversation = {
    id: chat.id,
    listing_id: `${chat.id}-listing`,
    buyer_id: DEMO_ME,
    seller_id: chat.other,
    status: chat.status,
    created_at: at(180),
    updated_at: at(5),
    trade_listings: [
      {
        id: `${chat.id}-listing`,
        user_id: chat.other,
        card_name: chat.name,
        set_name: 'Base',
        set_id: 'base1',
        card_number: String(chat.number),
        variant: 'Unlimited',
        condition: 'Near Mint',
        listing_type: 'trade',
        price: null,
        trade_description: 'Example: open to Base set holos',
        image_url: null,
        card_image_url: `https://images.pokemontcg.io/base1/${chat.number}.png`,
        is_active: true,
      },
    ],
  };
  const message = (n: number, sender: string, content: string, minutes: number): Message => ({
    id: `${chat.id}-msg-${n}`,
    conversation_id: chat.id,
    sender_id: sender,
    content,
    message_type: 'message',
    offer_amount: null,
    offer_status: null,
    created_at: at(minutes),
    read_at: at(minutes),
  });
  const messages = [
    message(1, DEMO_ME, `Example: hi, is the ${chat.name} still available?`, 120),
    message(2, chat.other, 'Example: yes, still here', 60),
    message(3, chat.other, chat.line, 5),
  ];
  const profile = demoProfileByUserId(chat.other);
  const profiles: Record<string, PublicProfile> = profile
    ? { [profile.user_id]: { user_id: profile.user_id, username: profile.username, display_name: profile.display_name } }
    : {};
  return { conversation, messages, profiles };
}

// Example binder for the CSV tool: made up, held in memory only.
export const DEMO_BINDER_SETS = [
  { id: 'base1', name: 'Base' },
  { id: 'sv1', name: 'Scarlet & Violet' },
];

export const DEMO_BINDER_ROWS = [
  { cardId: 'base1-4', cardName: 'Charizard', setName: 'Base', condition: 'LP', qty: 1, price: 250 },
  { cardId: 'base1-58', cardName: 'Pikachu', setName: 'Base', condition: 'NM', qty: 2, price: 12.5 },
  { cardId: 'sv1-1', cardName: 'Pineco', setName: 'Scarlet & Violet', condition: null, qty: 1, price: null },
];
