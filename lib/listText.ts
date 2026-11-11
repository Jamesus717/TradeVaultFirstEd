// Plain-text list for Discord and forums, grouped by set.
// Only name, set, qty and (wants) priority are read from each row. Nothing
// else is copied, so hidden fields such as postcode_prefix can never leak,
// and free-text notes are left out on purpose.

export type TextItem = {
  name: string;
  setName?: string | null;
  qty?: number | null;
  priority?: 'high' | 'medium' | 'low' | null;
};

const NO_SET = 'Other';

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function formatListText(title: string, items: readonly TextItem[]): string {
  if (items.length === 0) return `${title}: nothing yet`;
  const groups = new Map<string, TextItem[]>();
  for (const item of items) {
    const set = clean(item.setName ?? '') || NO_SET;
    const list = groups.get(set) ?? [];
    list.push(item);
    groups.set(set, list);
  }
  const sets = [...groups.keys()].sort((a, b) => {
    if (a === NO_SET) return 1;
    if (b === NO_SET) return -1;
    return a.localeCompare(b);
  });
  const lines = [`${title} (${items.length} ${items.length === 1 ? 'card' : 'cards'})`];
  for (const set of sets) {
    lines.push('', set);
    const cards = [...groups.get(set)!].sort((a, b) => a.name.localeCompare(b.name));
    for (const card of cards) {
      const qty = card.qty && card.qty > 1 ? ` x${card.qty}` : '';
      const flag = card.priority === 'high' ? ' (high priority)' : '';
      lines.push(`- ${clean(card.name) || 'Unknown card'}${qty}${flag}`);
    }
  }
  return lines.join('\n');
}
