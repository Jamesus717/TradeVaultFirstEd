// Binder summary card: pure logic. Summarises the owned cards in the shown
// list (so it follows the search and filters). Price is the one saved on the
// binder row (proposal 024); a card with none counts as "no price".
import type { DetailsById, FilterableCard } from './binderFilters';

export type BinderSummary = {
  cards: number;
  sets: number;
  value: number;
  priced: number;
  unpriced: number;
};

export function summarizeBinder<T extends FilterableCard & { setId?: string }>(
  shown: T[],
  owned: Record<string, boolean>,
  details: DetailsById
): BinderSummary {
  const sets = new Set<string>();
  let cards = 0;
  let cents = 0;
  let priced = 0;
  for (const card of shown) {
    if (!owned[card.id]) continue;
    cards += 1;
    sets.add(card.setId ?? card.baseCardId.slice(0, Math.max(card.baseCardId.lastIndexOf('-'), 0)));
    const price = details[card.baseCardId.toLowerCase()]?.price;
    if (typeof price === 'number' && Number.isFinite(price)) {
      priced += 1;
      cents += Math.round(price * 100);
    }
  }
  return { cards, sets: sets.size, value: cents / 100, priced, unpriced: cards - priced };
}

export function formatGbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function unpricedLine(n: number): string {
  return n === 1 ? '1 card has no price' : `${n} cards have no price`;
}

// Says what the numbers cover, in the same words as the filters.
export function summaryScope(filterCount: number, shown: number, inSet: number, setName: string): string {
  if (filterCount === 0) return `Everything you own in ${setName}`;
  return `Only the ${shown} of ${inSet} cards shown by your search and filters`;
}
