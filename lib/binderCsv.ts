// Binder CSV: export what you own, import a CSV after a preview.
// Columns: card, set, condition, qty, price.
// The card cell is "Name [card-id]" (a bare card id also works); the set cell is
// a set name or id. Saving goes through the same user_cards upsert the binder
// already uses. user_cards only records "owned" until proposal migration 024
// (supabase/proposals/024_binder_fields.sql) is applied, so condition, qty and
// price are checked and previewed, and stored only in demo mode or when
// saveImport is called with includeFields (after 024 is applied).

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeVariantForSet } from './constants/cardVariants';

export const CSV_COLUMNS = ['card', 'set', 'condition', 'qty', 'price'] as const;
export const MAX_CSV_BYTES = 256 * 1024;
export const MAX_CSV_ROWS = 2000;
export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;

export type ExportRow = {
  cardId: string;
  cardName: string;
  setName: string;
  condition?: string | null;
  qty?: number;
  price?: number | null;
  // ISO date the card joined the binder. Not part of the CSV; used for sorting.
  addedAt?: string | null;
};

export type SetRef = { id: string; name: string };

export type ImportRow = {
  line: number;
  card: string;
  set: string;
  condition: string;
  qty: string;
  price: string;
  errors: string[];
  // Present only when the row has no errors.
  value?: { cardId: string; setId: string; condition: string | null; qty: number; price: number | null };
};

export type ImportPreview = {
  rows: ImportRow[];
  fileError: string | null;
  validCount: number;
  errorCount: number;
};

// A cell that starts with one of these is run as a formula by Excel and Sheets.
const FORMULA_START = /^[=+\-@\t\r]/;

export function neutraliseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

// Undo our own export prefix, so a round trip gives back the original text.
export function restoreFormula(text: string): string {
  return /^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text;
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = neutraliseFormula(text);
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ExportRow[]): string {
  const lines: string[] = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(`${row.cardName} [${row.cardId}]`),
        escapeCsvCell(row.setName),
        escapeCsvCell(row.condition ?? ''),
        escapeCsvCell(row.qty ?? 1),
        // Numbers are written as numbers; never run through the formula guard.
        row.price === null || row.price === undefined ? '' : row.price.toFixed(2),
      ].join(',')
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

// RFC 4180 style: quoted cells, doubled quotes, newlines inside quotes.
export function parseCsv(text: string): string[][] | null {
  const input = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
    i++;
  }

  if (quoted) return null; // unterminated quote
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const CARD_ID = /^[a-z0-9.]+-[a-z0-9]+$/i;

export function readCard(cell: string): string | null {
  const text = cell.trim();
  const bracket = text.match(/\[([^\]]+)\]\s*$/);
  const id = (bracket ? bracket[1] : text).trim();
  return CARD_ID.test(id) ? id : null;
}

export function resolveSet(cell: string, cardId: string, sets: SetRef[]): string | null {
  const wanted = cell.trim().toLowerCase();
  if (!wanted) return null;
  const hit = sets.find((s) => s.id.toLowerCase() === wanted || s.name.toLowerCase() === wanted);
  if (hit) return hit.id;
  // Set list unavailable: accept a set id that matches the card id's prefix.
  if (sets.length === 0 && cardId.toLowerCase().startsWith(`${wanted}-`)) return wanted;
  return null;
}

const CONDITION_WORDS: Record<string, string> = {
  'near mint': 'NM',
  'lightly played': 'LP',
  'moderately played': 'MP',
  'heavily played': 'HP',
  damaged: 'DMG',
};

export function parseImport(text: string, sets: SetRef[], sizeBytes?: number): ImportPreview {
  const fail = (fileError: string): ImportPreview => ({ rows: [], fileError, validCount: 0, errorCount: 0 });
  const size = sizeBytes ?? new TextEncoder().encode(text).length;

  if (size > MAX_CSV_BYTES) return fail(`File is too big. The limit is ${MAX_CSV_BYTES / 1024} KB.`);
  const table = parseCsv(text);
  if (!table) return fail('The CSV has an unclosed quote.');
  if (table.length === 0) return fail('The file is empty.');

  const header = table[0].map((h) => restoreFormula(h).trim().toLowerCase());
  const index = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    (typeof CSV_COLUMNS)[number],
    number
  >;
  const missing = CSV_COLUMNS.filter((c) => index[c] === -1);
  if (missing.length > 0) return fail(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);

  const body = table.slice(1);
  if (body.length === 0) return fail('The file has a header but no rows.');
  if (body.length > MAX_CSV_ROWS) return fail(`Too many rows (${body.length}). The limit is ${MAX_CSV_ROWS}.`);

  const seen = new Set<string>();
  const rows: ImportRow[] = body.map((cells, n) => {
    const get = (c: (typeof CSV_COLUMNS)[number]) => restoreFormula((cells[index[c]] ?? '').trim());
    const row: ImportRow = {
      line: n + 2,
      card: get('card'),
      set: get('set'),
      condition: get('condition'),
      qty: get('qty'),
      price: get('price'),
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

    let condition: string | null = null;
    if (row.condition) {
      const upper = row.condition.toUpperCase();
      condition = (CONDITIONS as readonly string[]).includes(upper)
        ? upper
        : (CONDITION_WORDS[row.condition.toLowerCase()] ?? null);
      if (!condition) row.errors.push(`Condition must be ${CONDITIONS.join(', ')} or blank.`);
    }

    let qty = 1;
    if (row.qty) {
      qty = /^\d{1,3}$/.test(row.qty) ? Number(row.qty) : 0;
      if (qty < 1 || qty > 999) row.errors.push('Qty must be a whole number from 1 to 999.');
    }

    let price: number | null = null;
    if (row.price) {
      const cleaned = row.price.replace(/^£/, '');
      price = /^\d{1,6}(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : null;
      if (price === null || price <= 0) {
        price = null;
        row.errors.push('Price must be a number above 0 with up to 2 decimals.');
      }
    }

    if (row.errors.length === 0 && cardId && setId) {
      const key = `${cardId.toLowerCase()}|${condition ?? ''}`;
      if (seen.has(key)) row.errors.push('Duplicate of an earlier row.');
      seen.add(key);
    }

    if (row.errors.length === 0 && cardId && setId) {
      row.value = { cardId, setId, condition, qty, price };
    }
    return row;
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  return { rows, fileError: null, validCount, errorCount: rows.length - validCount };
}

// Demo mode keeps the binder in memory. One row per card (as user_cards keeps one
// row per card variant), so importing a card again replaces its details.
export function mergeBinderRows(current: ExportRow[], added: ExportRow[]): ExportRow[] {
  const byCard = new Map<string, ExportRow>();
  for (const row of [...current, ...added]) byCard.set(row.cardId.toLowerCase(), row);
  return [...byCard.values()];
}

const CHUNK = 200;

// Same upsert and conflict key as the binder's own writes (useBinder, quickAdd).
export async function saveImport(
  client: SupabaseClient,
  userId: string,
  rows: ImportRow[],
  options: { includeFields?: boolean } = {}
): Promise<{ ok: boolean; saved: number; message: string }> {
  const seen = new Set<string>();
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!row.value) continue;
    const { cardId, setId, condition, qty, price } = row.value;
    const variant = normalizeVariantForSet(setId, 'Normal');
    const key = `${cardId}|${variant}|${setId}`;
    if (seen.has(key)) continue; // same stack on two condition rows: one owned flag
    seen.add(key);
    records.push({
      user_id: userId,
      card_id: cardId,
      set_id: setId,
      variant,
      owned: true,
      ...(options.includeFields ? { condition, qty, price } : {}),
    });
  }

  let saved = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await client
      .from('user_cards')
      .upsert(chunk, { onConflict: 'user_id,card_id,variant,set_id' });
    if (error) {
      return { ok: false, saved, message: `Saved ${saved} before an error: ${error.message}` };
    }
    saved += chunk.length;
  }
  return { ok: true, saved, message: `Added ${saved} card${saved === 1 ? '' : 's'} to your binder.` };
}
