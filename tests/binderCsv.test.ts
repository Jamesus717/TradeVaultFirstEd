import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  escapeCsvCell,
  parseCsv,
  parseImport,
  saveImport,
  toCsv,
} from '../lib/binderCsv';

const sets = [
  { id: 'base1', name: 'Base' },
  { id: 'sv1', name: 'Scarlet & Violet' },
];
const HEADER = 'card,set,condition,qty,price';

describe('export', () => {
  it('writes the header and rows, quoting commas and quotes', () => {
    const csv = toCsv([
      { cardId: 'base1-4', cardName: 'Charizard', setName: 'Base', condition: 'LP', qty: 2, price: 250 },
      { cardId: 'sv1-1', cardName: 'Say "hi", Pineco', setName: 'Scarlet & Violet' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe('Charizard [base1-4],Base,LP,2,250.00');
    expect(lines[2]).toBe('"Say ""hi"", Pineco [sv1-1]",Scarlet & Violet,,1,');
  });

  it('neutralises formula injection in every text cell', () => {
    for (const bad of ['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx']) {
      expect(escapeCsvCell(bad).replace(/^"/, '')).toMatch(/^'/);
    }
    const csv = toCsv([{ cardId: 'x-1', cardName: '=HYPERLINK("http://evil")', setName: '@Base' }]);
    const table = parseCsv(csv)!;
    expect(table[1][0].startsWith("'=")).toBe(true);
    expect(table[1][1]).toBe("'@Base");
  });

  it('does not touch normal text', () => {
    expect(escapeCsvCell('Pikachu')).toBe('Pikachu');
  });
});

describe('import', () => {
  it('round-trips an export', () => {
    const csv = toCsv([
      { cardId: 'base1-4', cardName: 'Charizard', setName: 'Base', condition: 'NM', qty: 3, price: 12.5 },
    ]);
    const result = parseImport(csv, sets);
    expect(result.errorCount).toBe(0);
    expect(result.rows[0].value).toEqual({ cardId: 'base1-4', setId: 'base1', condition: 'NM', qty: 3, price: 12.5 });
  });

  it('restores a card name that began with a formula character', () => {
    const csv = toCsv([{ cardId: 'base1-4', cardName: '-Odd', setName: 'Base' }]);
    expect(parseImport(csv, sets).rows[0].card).toBe('-Odd [base1-4]');
  });

  it('reports per-row errors with line numbers and keeps good rows', () => {
    const text = [
      HEADER,
      'Charizard [base1-4],Base,NM,1,10',
      'Nameonly,Base,NM,1,10',
      'Pikachu [base1-58],Nowhere,NM,1,10',
      'Pineco [sv1-1],Scarlet & Violet,MINT,0,-5',
      'Mew [sv1-2],Base,,1,',
    ].join('\n');
    const result = parseImport(text, sets);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(4);
    expect(result.rows[1].line).toBe(3);
    expect(result.rows[1].errors[0]).toMatch(/id/);
    expect(result.rows[2].errors[0]).toMatch(/Unknown set/);
    expect(result.rows[3].errors).toHaveLength(3);
    expect(result.rows[4].errors[0]).toMatch(/does not belong/);
  });

  it('flags duplicates and handles quoted newlines', () => {
    const text = `${HEADER}\r\n"Charizard\n[base1-4]",Base,,1,\r\nCharizard [base1-4],Base,,1,\r\n`;
    const result = parseImport(text, sets);
    expect(result.rows[0].errors).toEqual([]);
    expect(result.rows[1].errors).toEqual(['Duplicate of an earlier row.']);
  });

  it('rejects missing columns, empty files and unclosed quotes', () => {
    expect(parseImport('card,set\nx,y', sets).fileError).toMatch(/Missing columns: condition, qty, price/);
    expect(parseImport('', sets).fileError).toMatch(/empty/);
    expect(parseImport(HEADER, sets).fileError).toMatch(/no rows/);
    expect(parseImport(`${HEADER}\n"oops,Base,,1,`, sets).fileError).toMatch(/quote/);
  });

  it('enforces size and row limits', () => {
    expect(parseImport(HEADER, sets, MAX_CSV_BYTES + 1).fileError).toMatch(/too big/);
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `C [base1-${i + 1}],Base,,1,`);
    expect(parseImport([HEADER, ...rows].join('\n'), sets).fileError).toMatch(/Too many rows/);
  });

  it('accepts a set id when the set list is unavailable', () => {
    const result = parseImport(`${HEADER}\nbase1-4,base1,,,`, []);
    expect(result.rows[0].value?.setId).toBe('base1');
  });
});

describe('saveImport', () => {
  function fakeClient(error: { message: string } | null = null) {
    const calls: { table: string; rows: Record<string, unknown>[]; options: unknown }[] = [];
    const client = {
      from: (table: string) => ({
        upsert: async (rows: Record<string, unknown>[], options: unknown) => {
          calls.push({ table, rows, options });
          return { error };
        },
      }),
    } as unknown as SupabaseClient;
    return { client, calls };
  }

  it('upserts owned rows into user_cards with the binder conflict key', async () => {
    const preview = parseImport(
      `${HEADER}\nCharizard [base1-4],Base,NM,1,\nPineco [sv1-1],Scarlet & Violet,LP,1,\nPineco [sv1-1],Scarlet & Violet,NM,1,\nbad,Base,,,`,
      sets
    );
    const { client, calls } = fakeClient();
    const result = await saveImport(client, 'user-1', preview.rows);
    expect(result).toMatchObject({ ok: true, saved: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('user_cards');
    expect(calls[0].options).toEqual({ onConflict: 'user_id,card_id,variant,set_id' });
    expect(calls[0].rows).toEqual([
      { user_id: 'user-1', card_id: 'base1-4', set_id: 'base1', variant: 'Unlimited', owned: true },
      { user_id: 'user-1', card_id: 'sv1-1', set_id: 'sv1', variant: 'Normal', owned: true },
    ]);
  });

  it('chunks large imports and reports a database error', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => `C [sv1-${i + 1}],sv1,,,`);
    const preview = parseImport([HEADER, ...rows].join('\n'), sets);
    const ok = fakeClient();
    await saveImport(ok.client, 'u', preview.rows);
    expect(ok.calls.map((c) => c.rows.length)).toEqual([200, 200, 50]);

    const bad = fakeClient({ message: 'boom' });
    const result = await saveImport(bad.client, 'u', preview.rows);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('boom');
  });
});
