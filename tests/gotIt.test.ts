import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { gotIt, undoGotIt, type GotItWant } from '../lib/gotIt';

const want: GotItWant = {
  id: 'w1',
  card_id: 'sv1-1',
  set_id: 'sv1',
  card_name: 'Pineco',
  card_number: '1',
  image_url: null,
  set_name: 'Scarlet & Violet',
  quantity: 2,
  priority: 'high',
  note: 'holo',
};

// Records every write; `fail` names operations (table.op) that return an error.
function fake(opts: { owned?: boolean; fail?: string[] } = {}) {
  const log: string[] = [];
  const failing = new Set(opts.fail ?? []);
  const res = (table: string, op: string) => {
    log.push(`${table}.${op}`);
    return { error: failing.has(`${table}.${op}`) ? { message: `${table}.${op} failed` } : null };
  };
  const client = {
    from: (table: string) => ({
      select: () => ({
        match: async () => ({ data: opts.owned ? [{ owned: true }] : [], ...res(table, 'select') }),
      }),
      upsert: async () => res(table, 'upsert'),
      insert: async (row: Record<string, unknown>) => {
        log.push(`row:${JSON.stringify(row.card_id)}`);
        return res(table, 'insert');
      },
      delete: () => ({
        eq: async () => res(table, 'delete'),
        match: async () => res(table, 'deleteMatch'),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, log };
}

describe('gotIt', () => {
  it('adds to the binder, then removes the want', async () => {
    const { client, log } = fake();
    const result = await gotIt(client, 'u1', want);
    expect(log).toEqual(['user_cards.select', 'user_cards.upsert', 'wishlist_cards.delete']);
    expect(result).toMatchObject({ ok: true, receipt: { binderAdded: true, variant: 'Normal' } });
  });

  it('leaves the binder alone when the card is already owned', async () => {
    const { client, log } = fake({ owned: true });
    const result = await gotIt(client, 'u1', want);
    expect(log).toEqual(['user_cards.select', 'wishlist_cards.delete']);
    expect(result).toMatchObject({ ok: true, receipt: { binderAdded: false } });
  });

  it('stops and keeps the want when the binder write fails', async () => {
    const { client, log } = fake({ fail: ['user_cards.upsert'] });
    const result = await gotIt(client, 'u1', want);
    expect(result).toEqual({ ok: false, message: 'user_cards.upsert failed' });
    expect(log).not.toContain('wishlist_cards.delete');
  });

  it('rolls the binder add back when removing the want fails', async () => {
    const { client, log } = fake({ fail: ['wishlist_cards.delete'] });
    const result = await gotIt(client, 'u1', want);
    expect(result).toEqual({ ok: false, message: 'wishlist_cards.delete failed' });
    expect(log).toEqual(['user_cards.select', 'user_cards.upsert', 'wishlist_cards.delete', 'user_cards.deleteMatch']);
  });

  it('does not touch an owned card when the want removal fails', async () => {
    const { client, log } = fake({ owned: true, fail: ['wishlist_cards.delete'] });
    await gotIt(client, 'u1', want);
    expect(log).not.toContain('user_cards.deleteMatch');
  });
});

describe('undoGotIt', () => {
  const receipt = { want, variant: 'Normal', binderAdded: true };

  it('restores the want and removes the binder add', async () => {
    const { client, log } = fake();
    const result = await undoGotIt(client, 'u1', receipt);
    expect(result).toEqual({ ok: true });
    expect(log).toEqual(['row:"sv1-1"', 'wishlist_cards.insert', 'user_cards.deleteMatch']);
  });

  it('keeps an already-owned card in the binder', async () => {
    const { client, log } = fake();
    await undoGotIt(client, 'u1', { ...receipt, binderAdded: false });
    expect(log).not.toContain('user_cards.deleteMatch');
  });

  it('reports an error and writes nothing else if the want cannot be restored', async () => {
    const { client, log } = fake({ fail: ['wishlist_cards.insert'] });
    const result = await undoGotIt(client, 'u1', receipt);
    expect(result.ok).toBe(false);
    expect(log).not.toContain('user_cards.deleteMatch');
  });

  it('removes the restored want again if the binder removal fails', async () => {
    const { client, log } = fake({ fail: ['user_cards.deleteMatch'] });
    const result = await undoGotIt(client, 'u1', receipt);
    expect(result.ok).toBe(false);
    expect(log.at(-1)).toBe('wishlist_cards.delete');
  });
});
