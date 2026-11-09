// Spares: cards you hold more than one of. spares = qty - 1 (keep one).
// Pure logic, no React. Reads only name, set and qty, never notes.
import type { TextItem } from './listText';

export type SpareRow = { cardId: string; cardName: string; setName?: string | null; qty?: number | null };
export type SpareItem = { cardId: string; name: string; setName: string; spares: number };
export type SpareGroup = { setName: string; items: SpareItem[]; total: number };

const NO_SET = 'Other';

export function findSpares(rows: readonly SpareRow[]): SpareItem[] {
  const out: SpareItem[] = [];
  for (const r of rows) {
    const qty = Number.isFinite(r.qty) ? Math.floor(r.qty as number) : 1;
    if (qty > 1) {
      out.push({
        cardId: r.cardId,
        name: r.cardName.trim() || 'Unknown card',
        setName: (r.setName ?? '').trim() || NO_SET,
        spares: qty - 1,
      });
    }
  }
  return out;
}

export function groupSparesBySet(items: readonly SpareItem[]): SpareGroup[] {
  const map = new Map<string, SpareItem[]>();
  for (const i of items) map.set(i.setName, [...(map.get(i.setName) ?? []), i]);
  return [...map.entries()]
    .sort(([a], [b]) => (a === NO_SET ? 1 : b === NO_SET ? -1 : a.localeCompare(b)))
    .map(([setName, list]) => ({
      setName,
      items: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      total: list.reduce((n, i) => n + i.spares, 0),
    }));
}

// For the B45 copy helper: qty is the number of spares, nothing else.
export function sparesToTextItems(items: readonly SpareItem[]): TextItem[] {
  return items.map((i) => ({ name: i.name, setName: i.setName, qty: i.spares }));
}
