// Print checklist rows: pure logic. Binder order, one row per card variant.
export type ChecklistCard = { id: string; name: string; number: string; variant: string };
export type ChecklistRow = { id: string; number: string; name: string; variant: string; owned: boolean };

const num = (n: string) => Number.parseInt(n.replace(/\D/g, ''), 10) || 0;

export function buildChecklist(cards: ChecklistCard[], owned: Record<string, boolean>): ChecklistRow[] {
  return [...cards]
    .sort((a, b) => num(a.number) - num(b.number) || a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant))
    .map((c) => ({ id: c.id, number: c.number, name: c.name, variant: c.variant, owned: Boolean(owned[c.id]) }));
}

export function printChecklistHref(setId: string): string {
  return `/binder/print?set=${encodeURIComponent(setId)}`;
}
