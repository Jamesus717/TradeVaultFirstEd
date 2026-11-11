import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addMissingToWants, pickMissing, undoMissingToWants, type MissingCard } from '../lib/missingToWants';

const card = (n: number, variant = 'normal'): MissingCard => ({
  id: `base1-${n}-${variant}`,
  baseCardId: `base1-${n}`,
  setId: 'base1',
  setName: 'Base',
  name: `Card ${n}`,
  number: String(n),
  image: `img${n}`,
});

type Row = { card_id: string; user_id: string };

function fakeClient(opts: { existing?: string[]; failInsertAt?: number } = {}) {
  const rows: Row[] = (opts.existing ?? []).map((card_id) => ({ card_id, user_id: 'u' }));
  let inserts = 0;
  const client = {
    from() {
      return {
        select: () => ({
          eq: () => ({
            in: async (_c: string, ids: string[]) => ({
              data: rows.filter((r) => ids.includes(r.card_id)).map((r) => ({ card_id: r.card_id })),
              error: null,
            }),
          }),
        }),
        insert: async (batch: Row[]) => {
          inserts += 1;
          if (opts.failInsertAt === inserts) return { error: { message: 'boom' } };
          rows.push(...batch);
          return { error: null };
        },
        delete: () => ({
          eq: () => ({
            in: async (_c: string, ids: string[]) => {
              for (let i = rows.length - 1; i >= 0; i--) if (ids.includes(rows[i].card_id)) rows.splice(i, 1);
              return { error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, rows };
}

describe('pickMissing', () => {
  it('skips owned (any printing), wanted and duplicate printings', () => {
    const cards = [card(1), card(1, 'reverse'), card(2), card(3), card(4)];
    const owned = { [cards[1].id]: true, [cards[2].id]: false };
    const picked = pickMissing(cards, owned, new Set(['base1-3']));
    expect(picked.map((c) => c.baseCardId)).toEqual(['base1-2', 'base1-4']);
  });
  it('returns nothing when the set is complete', () => {
    const cards = [card(1)];
    expect(pickMissing(cards, { [cards[0].id]: true }, new Set())).toEqual([]);
  });
});

describe('addMissingToWants', () => {
  it('inserts only cards not already wanted, across chunks', async () => {
    const cards = Array.from({ length: 250 }, (_, i) => card(i + 1));
    const { client, rows } = fakeClient({ existing: ['base1-5'] });
    const r = await addMissingToWants(client, 'u', cards);
    expect(r).toMatchObject({ ok: true, added: 249 });
    expect(rows.length).toBe(250);
  });
  it('rolls back earlier chunks when a later insert fails', async () => {
    const cards = Array.from({ length: 150 }, (_, i) => card(i + 1));
    const { client, rows } = fakeClient({ failInsertAt: 2 });
    const r = await addMissingToWants(client, 'u', cards);
    expect(r).toEqual({ ok: false, message: 'boom' });
    expect(rows.length).toBe(0);
  });
  it('undo removes exactly what was added and keeps prior wants', async () => {
    const { client, rows } = fakeClient({ existing: ['base1-9'] });
    const r = await addMissingToWants(client, 'u', [card(1), card(2), card(9)]);
    if (!r.ok) throw new Error('add failed');
    expect(r.receipt.cardIds).toEqual(['base1-1', 'base1-2']);
    expect(await undoMissingToWants(client, 'u', r.receipt)).toEqual({ ok: true });
    expect(rows.map((x) => x.card_id)).toEqual(['base1-9']);
  });
});
