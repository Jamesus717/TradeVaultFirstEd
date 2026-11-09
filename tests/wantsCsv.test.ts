import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { MAX_CSV_BYTES, MAX_CSV_ROWS, mergeWants, parseWantsImport, saveWantsImport, toWantsCsv } from '../lib/wantsCsv';
import { parseCsv } from '../lib/binderCsv';

const sets = [
  { id: 'base1', name: 'Base' },
  { id: 'sv1', name: 'Scarlet & Violet' },
];
const HEADER = 'card,set,priority,qty,note';

describe('wants export', () => {
  it('writes header and rows, quoting commas and guarding formulas', () => {
    const csv = toWantsCsv([
      { cardId: 'base1-4', cardName: 'Charizard', setName: 'Base', priority: 'high', qty: 2, note: 'holo, please' },
      { cardId: 'sv1-1', cardName: 'Pineco', setName: 'Scarlet & Violet', note: '=1+1' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe('Charizard [base1-4],Base,high,2,"holo, please"');
    expect(lines[2]).toBe("Pineco [sv1-1],Scarlet & Violet,medium,1,'=1+1");
    expect(parseCsv(csv)![2][4]).toBe("'=1+1");
  });
});

describe('wants import', () => {
  it('round-trips an export and restores guarded notes', () => {
    const csv = toWantsCsv([
      { cardId: 'base1-4', cardName: 'Charizard', setName: 'Base', priority: 'low', qty: 3, note: '-odd' },
    ]);
    const result = parseWantsImport(csv, sets);
    expect(result.errorCount).toBe(0);
    expect(result.rows[0].value).toMatchObject({
      cardId: 'base1-4',
      cardName: 'Charizard',
      setId: 'base1',
      setName: 'Base',
      cardNumber: '4',
      priority: 'low',
      qty: 3,
      note: '-odd',
    });
  });

  it('defaults optional columns and works with only card and set', () => {
    const result = parseWantsImport('card,set\nCharizard [base1-4],Base', sets);
    expect(result.rows[0].value).toMatchObject({ priority: 'medium', qty: 1, note: null });
  });

  it('reports per-row errors with line numbers and keeps good rows', () => {
    const text = [
      HEADER,
      'Charizard [base1-4],Base,high,1,',
      'Nameonly,Base,,,',
      'Pikachu [base1-58],Nowhere,,,',
      'Pineco [sv1-1],Scarlet & Violet,urgent,0,',
      'Mew [sv1-2],Base,,,',
      `Eevee [sv1-3],sv1,,,${'x'.repeat(201)}`,
    ].join('\n');
    const result = parseWantsImport(text, sets);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(5);
    expect(result.rows[1].line).toBe(3);
    expect(result.rows[1].errors[0]).toMatch(/id/);
    expect(result.rows[2].errors[0]).toMatch(/Unknown set/);
    expect(result.rows[3].errors).toHaveLength(2);
    expect(result.rows[4].errors[0]).toMatch(/does not belong/);
    expect(result.rows[5].errors[0]).toMatch(/200/);
  });

  it('flags duplicate cards', () => {
    const result = parseWantsImport(`${HEADER}\nCharizard [base1-4],Base,,,\nbase1-4,Base,high,,`, sets);
    expect(result.rows[1].errors).toEqual(['Duplicate of an earlier row.']);
  });

  it('rejects missing columns, empty files, unclosed quotes and limits', () => {
    expect(parseWantsImport('card\nx', sets).fileError).toMatch(/Missing column: set/);
    expect(parseWantsImport('', sets).fileError).toMatch(/empty/);
    expect(parseWantsImport(HEADER, sets).fileError).toMatch(/no rows/);
    expect(parseWantsImport(`${HEADER}\n"oops,Base,,,`, sets).fileError).toMatch(/quote/);
    expect(parseWantsImport(HEADER, sets, MAX_CSV_BYTES + 1).fileError).toMatch(/too big/);
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `C [base1-${i + 1}],Base,,,`);
    expect(parseWantsImport([HEADER, ...rows].join('\n'), sets).fileError).toMatch(/Too many rows/);
  });
});

describe('mergeWants', () => {
  it('replaces a card that is already listed', () => {
    const merged = mergeWants([{ card_id: 'a', n: 1 }, { card_id: 'b', n: 1 }], [{ card_id: 'b', n: 2 }]);
    expect(merged).toEqual([
      { card_id: 'b', n: 2 },
      { card_id: 'a', n: 1 },
    ]);
  });
});

describe('saveWantsImport', () => {
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

  it('upserts wishlist_cards on the existing unique key', async () => {
    const preview = parseWantsImport(`${HEADER}\nCharizard [base1-4],Base,high,2,hi\nbad,Base,,,`, sets);
    const { client, calls } = fakeClient();
    const result = await saveWantsImport(client, 'user-1', preview.rows);
    expect(result).toMatchObject({ ok: true, saved: 1 });
    expect(calls[0].table).toBe('wishlist_cards');
    expect(calls[0].options).toEqual({ onConflict: 'user_id,card_id' });
    expect(calls[0].rows[0]).toMatchObject({
      user_id: 'user-1',
      card_id: 'base1-4',
      set_id: 'base1',
      card_name: 'Charizard',
      card_number: '4',
      set_name: 'Base',
      quantity: 2,
      priority: 'high',
      note: 'hi',
    });
  });

  it('chunks large imports and reports a database error', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => `C [sv1-${i + 1}],sv1,,,`);
    const preview = parseWantsImport([HEADER, ...rows].join('\n'), sets);
    const ok = fakeClient();
    await saveWantsImport(ok.client, 'u', preview.rows);
    expect(ok.calls.map((c) => c.rows.length)).toEqual([200, 200, 50]);
    const bad = fakeClient({ message: 'boom' });
    const result = await saveWantsImport(bad.client, 'u', preview.rows);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('boom');
  });
});
