import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { CardSearchResult } from '../app/trade/types';
import { saveQuickAdd } from '../lib/quickAdd';

const scarlet: CardSearchResult = {
  id: 'sv1-1',
  name: 'Pineco',
  number: '1',
  set: { id: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet' },
  images: { small: 'https://images.example/sv1-1.png' },
};

const charizard: CardSearchResult = {
  id: 'base1-4',
  name: 'Charizard',
  number: '4',
  set: { id: 'base1', name: 'Base', series: 'Base' },
};

type Call = { table: string; method: 'upsert' | 'insert'; row: Record<string, unknown>; options?: unknown };

function fakeClient(error: { code?: string; message: string } | null = null) {
  const calls: Call[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>, options: unknown) => {
        calls.push({ table, method: 'upsert', row, options });
        return { error };
      },
      insert: async (row: Record<string, unknown>) => {
        calls.push({ table, method: 'insert', row });
        return { error };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('saveQuickAdd', () => {
  it('upserts an owned card on the key the binder uses', async () => {
    const { client, calls } = fakeClient();
    const result = await saveQuickAdd(client, 'user-1', scarlet, 'owned');

    expect(calls).toEqual([
      {
        table: 'user_cards',
        method: 'upsert',
        row: { user_id: 'user-1', card_id: 'sv1-1', set_id: 'sv1', variant: 'Normal', owned: true },
        options: { onConflict: 'user_id,card_id,variant,set_id' },
      },
    ]);
    expect(result).toEqual({ ok: true, message: 'Added Pineco to your binder.', variant: 'Normal' });
  });

  it('saves a vintage card as Unlimited, the variant the binder shows', async () => {
    const { client, calls } = fakeClient();
    const result = await saveQuickAdd(client, 'user-1', charizard, 'owned');

    expect(calls[0].row.variant).toBe('Unlimited');
    expect(result.variant).toBe('Unlimited');
  });

  it('adds a wanted card to the wishlist with its details', async () => {
    const { client, calls } = fakeClient();
    const result = await saveQuickAdd(client, 'user-1', scarlet, 'wanted');

    expect(calls).toEqual([
      {
        table: 'wishlist_cards',
        method: 'insert',
        row: {
          user_id: 'user-1',
          card_id: 'sv1-1',
          set_id: 'sv1',
          card_name: 'Pineco',
          card_number: '1',
          image_url: 'https://images.example/sv1-1.png',
          set_name: 'Scarlet & Violet',
        },
      },
    ]);
    expect(result.message).toBe('Added Pineco to your wishlist.');
  });

  it('says so when the card is already on the wishlist', async () => {
    const { client } = fakeClient({ code: '23505', message: 'duplicate key' });
    const result = await saveQuickAdd(client, 'user-1', scarlet, 'wanted');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Pineco is already on your wishlist.');
  });

  it('passes other errors through', async () => {
    const { client } = fakeClient({ code: '42501', message: 'permission denied' });
    const result = await saveQuickAdd(client, 'user-1', scarlet, 'owned');

    expect(result).toMatchObject({ ok: false, message: 'permission denied' });
  });
});
