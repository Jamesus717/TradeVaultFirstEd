// Share cards: what the Open Graph / Twitter tags and the generated image say
// about a public profile or shop. Everything shown is picked here, from an
// allow-list of fields, so a field the public view hides can never leak into a
// card. `postcode_prefix`, address, user ids and emails are never selected.
// Unknown slugs and lookup failures return the generic site card, never an error.

import { createClient } from '@supabase/supabase-js';
import { DEMO_BINDER_ROWS, DEMO_SHOPS, demoMode, demoProfileBySlug } from './demo';
import { isSlug } from './detailRoutes';

export const SITE_NAME = 'TradeBinder';
export const MAX_TOP_CARDS = 3;

export type ShareCard = {
  kind: 'profile' | 'shop' | 'generic';
  // Headline on the image (no site name).
  heading: string;
  title: string;
  description: string;
  stat: string | null;
  statLabel: string | null;
  topCards: string[];
};

export const GENERIC_CARD: ShareCard = {
  kind: 'generic',
  heading: 'Pokémon TCG collection tracker',
  title: SITE_NAME,
  description: 'Track Pokémon TCG collections, completion and wishlists, and trade with other collectors.',
  stat: null,
  statLabel: null,
  topCards: [],
};

type OwnedRow = { card_id: string; price: number | null };

// The only profile / shop fields a card may use.
export type ShareProfileInput = { display_name: string | null; username: string | null };
export type ShareShopInput = { name: string; town: string | null; games: string[] | null };

const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`;

// Highest priced first, then card id for a stable order. Cards with no known name are skipped.
export function pickTopCards(rows: OwnedRow[], names: Record<string, string>, max = MAX_TOP_CARDS) {
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.card_id)) return false;
    seen.add(row.card_id);
    return true;
  });
  return unique
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || a.card_id.localeCompare(b.card_id))
    .map((row) => clean(names[row.card_id]))
    .filter(Boolean)
    .slice(0, max);
}

export function buildProfileCard(profile: ShareProfileInput, cardCount: number, topCards: string[]): ShareCard {
  const name = clean(profile.display_name) || clean(profile.username) || 'A collector';
  const top = topCards.slice(0, MAX_TOP_CARDS);
  const parts = [`${name}'s binder: ${plural(cardCount, 'card')}`];
  if (top.length) {
    parts.push(`including ${top.join(', ')}`);
  }
  return {
    kind: 'profile',
    heading: name,
    title: `${name} on ${SITE_NAME}`,
    description: `${parts.join(' ')}.`,
    stat: String(cardCount),
    statLabel: cardCount === 1 ? 'card' : 'cards',
    topCards: top,
  };
}

export function buildShopCard(shop: ShareShopInput): ShareCard {
  const name = clean(shop.name) || 'A card shop';
  const town = clean(shop.town);
  const games = (shop.games ?? []).map(clean).filter(Boolean);
  const bits = [town && `in ${town}`, games.length && `for ${games.join(', ')}`].filter(Boolean);
  return {
    kind: 'shop',
    heading: name,
    title: `${name} on ${SITE_NAME}`,
    description: `${name}${bits.length ? ' ' + bits.join(' ') : ''}. Trade cards here with other collectors.`,
    stat: town || null,
    statLabel: town ? 'shop' : null,
    topCards: games,
  };
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function loadProfileCard(slug: string): Promise<ShareCard> {
  try {
    if (demoMode) {
      const demo = demoProfileBySlug(slug);
      if (!demo) return GENERIC_CARD;
      const rows = DEMO_BINDER_ROWS.map((r) => ({ card_id: r.cardId, price: r.price }));
      const names = Object.fromEntries(DEMO_BINDER_ROWS.map((r) => [r.cardId, r.cardName]));
      return buildProfileCard(demo, rows.length, pickTopCards(rows, names));
    }
    const db = client();
    if (!db || !isSlug(slug)) return GENERIC_CARD;

    const { data: profile } = await db
      .from('public_profiles')
      .select('user_id, display_name, username')
      .eq('profile_slug', slug)
      .maybeSingle();
    if (!profile?.user_id) return GENERIC_CARD;

    const { data: owned } = await db
      .from('user_cards')
      .select('card_id')
      .eq('user_id', profile.user_id)
      .eq('owned', true)
      .limit(5000);
    const ids = Array.from(new Set((owned ?? []).map((row) => String(row.card_id))));

    const sample = ids.slice(0, 500);
    const [{ data: prices }, { data: names }] = sample.length
      ? await Promise.all([
          db.from('card_prices').select('card_id, price_mid').in('card_id', sample),
          db.from('catalog_cards').select('id, name').eq('game', 'pokemon').in('id', sample),
        ])
      : [{ data: null }, { data: null }];

    const priceById = new Map((prices ?? []).map((p) => [String(p.card_id), Number(p.price_mid)]));
    const nameById = Object.fromEntries((names ?? []).map((n) => [String(n.id), String(n.name)]));
    const rows = ids.map((id) => ({ card_id: id, price: priceById.get(id) ?? null }));
    return buildProfileCard(profile, ids.length, pickTopCards(rows, nameById));
  } catch {
    return GENERIC_CARD;
  }
}

export async function loadShopCard(slug: string): Promise<ShareCard> {
  try {
    if (demoMode) {
      const shop = DEMO_SHOPS.find((s) => s.slug === slug);
      return shop ? buildShopCard(shop) : GENERIC_CARD;
    }
    const db = client();
    if (!db || !isSlug(slug)) return GENERIC_CARD;
    const { data } = await db.from('shops').select('name, town, games').eq('slug', slug).maybeSingle();
    return data ? buildShopCard(data as ShareShopInput) : GENERIC_CARD;
  } catch {
    return GENERIC_CARD;
  }
}

// Next.js Metadata for a card. Images come from the opengraph-image / twitter-image files.
export function cardMetadata(card: ShareCard, path: string) {
  return {
    title: card.title,
    description: card.description,
    openGraph: { title: card.title, description: card.description, siteName: SITE_NAME, type: 'website' as const, url: path },
    twitter: { card: 'summary_large_image' as const, title: card.title, description: card.description },
  };
}
