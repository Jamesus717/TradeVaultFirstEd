// Card-for-card offers in the trade chat, with no new table or column.
//
// An offer is an ordinary 'message' row. Its content is a readable line (so
// older app versions and the notification text still make sense) followed by
// a tagged JSON line the chat turns into an offer card:
//
//   Card offer: Blastoise, Pikachu + £5.00
//   [tb-card-offer:v1] {"cards":[{"id":"base1-2","name":"Blastoise","variant":"Normal"}],"cash":5}
//
// Nothing in the payload is trusted for money: values come from card_prices by
// card id, and anyone could type the tag by hand, so parsing is strict and a
// bad payload just shows as a normal message. Card offers have no
// accept/decline buttons, because offer_status only exists on 'offer' rows
// (those need an amount above £0). Replies happen in the chat.

export const CARD_OFFER_TAG = '[tb-card-offer:v1]';
export const MAX_OFFER_CARDS = 12;
const MAX_NAME = 80;
const MAX_CASH = 100_000;

export type OfferedCard = { id: string; name: string; variant: string | null };
export type CardOffer = { cards: OfferedCard[]; cash: number | null };

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  return text || null;
}

function cleanCash(value: unknown) {
  if (value === null || value === undefined) return null;
  const amount = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_CASH) return null;
  return Math.round(amount * 100) / 100;
}

function cleanCards(value: unknown): OfferedCard[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_OFFER_CARDS) return null;
  const cards: OfferedCard[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    const id = cleanText(entry.id, 64);
    if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) return null;
    cards.push({ id, name: cleanText(entry.name, MAX_NAME) ?? id, variant: cleanText(entry.variant, 40) });
  }
  return cards;
}

export function cardOfferSummary(offer: CardOffer) {
  const names = offer.cards.map((card) => card.name).join(', ');
  return `Card offer: ${names}${offer.cash ? ` + ${gbp.format(offer.cash)}` : ''}`;
}

// Builds the message content for a card offer. Throws on an empty or oversize
// offer so the composer can't send one.
export function encodeCardOffer(offer: CardOffer): string {
  const cards = cleanCards(offer.cards);
  if (!cards) throw new Error(`Pick between 1 and ${MAX_OFFER_CARDS} cards.`);
  const clean: CardOffer = { cards, cash: cleanCash(offer.cash) };
  return `${cardOfferSummary(clean)}\n${CARD_OFFER_TAG} ${JSON.stringify(clean)}`;
}

// The offer in a message's content, or null if it isn't a (valid) card offer.
export function parseCardOffer(content: string | null | undefined): CardOffer | null {
  if (!content) return null;
  const at = content.lastIndexOf(CARD_OFFER_TAG);
  if (at === -1) return null;
  try {
    const data = JSON.parse(content.slice(at + CARD_OFFER_TAG.length)) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    const cards = cleanCards(data.cards);
    if (!cards) return null;
    return { cards, cash: cleanCash(data.cash) };
  } catch {
    return null;
  }
}
