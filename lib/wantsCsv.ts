// Wants CSV: export the wishlist, import a CSV after a preview.
// Columns: card, set, priority, qty, note. Card is "Name [card-id]" (a bare id
// works); set is a set name or id; priority is high/medium/low or blank
// (medium). Saving uses the wishlist's own wishlist_cards write (upsert on the
// existing unique (user_id, card_id) key). No migration needed; target prices
// (proposal 023) are not part of the CSV.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  escapeCsvCell,
  parseCsv,
  readCard,
  resolveSet,
  restoreFormula,
} from './binderCsv';
import type { SetRef } from './binderCsv';

export { MAX_CSV_BYTES, MAX_CSV_ROWS };
export const WANTS_COLUMNS = ['card', 'set', 'priority', 'qty', 'note'] as const;
// Only card and set are needed; the rest default (medium, 1, no note).
export const REQUIRED_COLUMNS = ['card', 'set'] as const;
export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type WantPriority = (typeof PRIORITIES)[number];

export type WantExportRow = {
  cardId: string;
  cardName: string;
  setName: string;
  priority?: WantPriority | null;
  qty?: number;
  note?: string | null;
};

export type WantValue = {
  cardId: string;
  cardName: string;
  setId: string;
  setName: string;
  cardNumber: string;
  priority: WantPriority;
  qty: number;
  note: string | null;
};

export type WantImportRow = {
  line: number;
  card: string;
  set: string;
  priority: string;
  qty: string;
  note: string;
  errors: string[];
  // Present only when the row has no errors.
  value?: WantValue;
};

export type WantImportPreview = {
  rows: WantImportRow[];
  fileError: string | null;
  validCount: number;
  errorCount: number;
};

export function toWantsCsv(rows: WantExportRow[]): string {
  const lines: string[] = [WANTS_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(`${row.cardName} [${row.cardId}]`),
        escapeCsvCell(row.setName),
        escapeCsvCell(row.priority ?? 'medium'),
        escapeCsvCell(row.qty ?? 1),
        escapeCsvCell(row.note ?? ''),
      ].join(',')
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function parseWantsImport(text: string, sets: SetRef[], sizeBytes?: number): WantImportPreview {
  const fail = (fileError: string): WantImportPreview => ({ rows: [], fileError, validCount: 0, errorCount: 0 });
  const size = sizeBytes ?? new TextEncoder().encode(text).length;

  if (size > MAX_CSV_BYTES) return fail(`File is too big. The limit is ${MAX_CSV_BYTES / 1024} KB.`);
  const table = parseCsv(text);
  if (!table) return fail('The CSV has an unclosed quote.');
  if (table.length === 0) return fail('The file is empty.');

  const header = table[0].map((h) => restoreFormula(h).trim().toLowerCase());
  const index = Object.fromEntries(WANTS_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    (typeof WANTS_COLUMNS)[number],
    number
  >;
  const missing = REQUIRED_COLUMNS.filter((c) => index[c] === -1);
  if (missing.length > 0) return fail(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);

  const body = table.slice(1);
  if (body.length === 0) return fail('The file has a header but no rows.');
  if (body.length > MAX_CSV_ROWS) return fail(`Too many rows (${body.length}). The limit is ${MAX_CSV_ROWS}.`);

  const seen = new Set<string>();
  const rows: WantImportRow[] = body.map((cells, n) => {
    const get = (c: (typeof WANTS_COLUMNS)[number]) =>
      index[c] === -1 ? '' : restoreFormula((cells[index[c]] ?? '').trim());
    const row: WantImportRow = {
      line: n + 2,
      card: get('card'),
      set: get('set'),
      priority: get('priority'),
      qty: get('qty'),
      note: get('note'),
      errors: [],
    };

    const cardId = readCard(row.card);
    if (!cardId) row.errors.push('Card needs an id, like "Charizard [base1-4]".');

    const setId = cardId ? resolveSet(row.set, cardId, sets) : null;
    if (cardId && !row.set) row.errors.push('Set is empty.');
    else if (cardId && !setId) row.errors.push(`Unknown set "${row.set}".`);
    else if (cardId && setId && !cardId.toLowerCase().startsWith(`${setId.toLowerCase()}-`)) {
      row.errors.push(`Card ${cardId} does not belong to set ${setId}.`);
    }

    let priority: WantPriority = 'medium';
    if (row.priority) {
      const lower = row.priority.toLowerCase();
      if ((PRIORITIES as readonly string[]).includes(lower)) priority = lower as WantPriority;
      else row.errors.push(`Priority must be ${PRIORITIES.join(', ')} or blank.`);
    }

    let qty = 1;
    if (row.qty) {
      qty = /^\d{1,2}$/.test(row.qty) ? Number(row.qty) : 0;
      if (qty < 1 || qty > 99) row.errors.push('Qty must be a whole number from 1 to 99.');
    }

    if (row.note.length > 200) row.errors.push('Note is over 200 characters.');

    if (row.errors.length === 0 && cardId && setId) {
      const key = cardId.toLowerCase();
      if (seen.has(key)) row.errors.push('Duplicate of an earlier row.');
      seen.add(key);
    }

    if (row.errors.length === 0 && cardId && setId) {
      const knownSet = sets.find((s) => s.id.toLowerCase() === setId.toLowerCase());
      row.value = {
        cardId,
        cardName: row.card.replace(/\s*\[[^\]]*\]\s*$/, '').trim() || cardId,
        setId,
        setName: knownSet?.name ?? row.set,
        cardNumber: cardId.slice(setId.length + 1),
        priority,
        qty,
        note: row.note || null,
      };
    }
    return row;
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  return { rows, fileError: null, validCount, errorCount: rows.length - validCount };
}

// Demo mode keeps the list in the page. An imported card replaces the same card.
export function mergeWants<T extends { card_id: string }>(current: T[], added: T[]): T[] {
  const addedIds = new Set(added.map((r) => r.card_id));
  return [...added, ...current.filter((r) => !addedIds.has(r.card_id))];
}

const CHUNK = 200;

// Same table and unique key (user_id, card_id) the wishlist page writes to.
export async function saveWantsImport(
  client: SupabaseClient,
  userId: string,
  rows: WantImportRow[]
): Promise<{ ok: boolean; saved: number; message: string }> {
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!row.value) continue;
    const v = row.value;
    records.push({
      user_id: userId,
      card_id: v.cardId,
      set_id: v.setId,
      card_name: v.cardName,
      card_number: v.cardNumber,
      image_url: `https://images.pokemontcg.io/${v.setId}/${v.cardNumber}.png`,
      set_name: v.setName,
      quantity: v.qty,
      priority: v.priority,
      note: v.note,
    });
  }

  let saved = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await client.from('wishlist_cards').upsert(chunk, { onConflict: 'user_id,card_id' });
    if (error) return { ok: false, saved, message: `Saved ${saved} before an error: ${error.message}` };
    saved += chunk.length;
  }
  return { ok: true, saved, message: `Added ${saved} card${saved === 1 ? '' : 's'} to your wishlist.` };
}
