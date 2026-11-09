// Per-set progress: pure logic. Uses the owned and total counts the binder
// already has, no new data.
import { EMPTY_FILTERS, serializeFilters, type BinderFilters } from './binderFilters';

export type SetProgress = {
  owned: number;
  total: number;
  missing: number;
  pct: number;
  complete: boolean;
};

export function setProgress(owned: number, total: number): SetProgress {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const o = Math.min(Math.max(Number.isFinite(owned) ? Math.floor(owned) : 0, 0), t);
  const complete = t > 0 && o === t;
  // Floor so 99.6% never reads as 100% while a card is still missing.
  const pct = t === 0 ? 0 : complete ? 100 : Math.floor((o / t) * 100);
  return { owned: o, total: t, missing: t - o, pct, complete };
}

// The binder filter (B30) showing only missing cards of one set.
export const MISSING_FILTERS: BinderFilters = { ...EMPTY_FILTERS, own: 'unowned' };

export function missingCardsHref(setId: string): string {
  const query = serializeFilters(MISSING_FILTERS, { set: setId });
  return `/binder?${query}`;
}
