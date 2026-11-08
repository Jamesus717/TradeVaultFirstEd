// Rows for the "Offer cards" picker in the trade chat: the cards a user owns
// (user_cards), one row per card and printing. user_cards holds only ids, so
// names come from the set lists the card routes already serve and cache, and
// images fall back to the pokemontcg.io pattern for the id.
// Pure, so it is unit-tested without a database.

export type OwnedRow = { card_id: string; variant: string | null; set_id?: string | null };
export type CardName = { name: string; number?: string | null; image?: string | null };
export type PickableCard = {
  key: string;
  id: string;
  variant: string | null;
  name: string;
  number: string;
  image: string | null;
};

// 'base1-4' -> { set: 'base1', number: '4' }. Set ids can hold dashes
// ('sv3pt5-12'), so the number is whatever follows the last one.
export function splitCardId(id: string) {
  const at = id.lastIndexOf('-');
  return at > 0 ? { set: id.slice(0, at), number: id.slice(at + 1) } : { set: id, number: '' };
}

export function pickableKey(id: string, variant: string | null) {
  return `${id}|${variant ?? ''}`;
}

export function toPickable(rows: OwnedRow[], names: Record<string, CardName>): PickableCard[] {
  const seen = new Set<string>();
  const out: PickableCard[] = [];
  for (const row of rows) {
    if (!row.card_id) continue;
    const key = pickableKey(row.card_id, row.variant);
    if (seen.has(key)) continue;
    seen.add(key);
    const known = names[row.card_id];
    const { set, number } = splitCardId(row.card_id);
    out.push({
      key,
      id: row.card_id,
      variant: row.variant,
      name: known?.name ?? `${set} #${number}`,
      number: known?.number ?? number,
      image: known?.image ?? (number ? `https://images.pokemontcg.io/${set}/${number}.png` : null),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || (a.variant ?? '').localeCompare(b.variant ?? ''));
}

export function filterPickable(cards: PickableCard[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter((card) =>
    [card.name, card.id, card.variant ?? '', card.number].some((field) => field.toLowerCase().includes(q))
  );
}

// The sets to fetch names for, most-owned first, capped so a huge collection
// doesn't fire dozens of requests when the picker opens.
export function setsToName(rows: OwnedRow[], cap = 8) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const set = row.set_id || splitCardId(row.card_id).set;
    counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([set]) => set);
}
