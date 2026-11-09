// "Got it" on a want: add the card to the binder, then drop the want. Uses the
// existing user_cards and wishlist_cards writes (no new tables). If the second
// write fails, the binder write is rolled back so nothing is half-moved.
// Undo reverses both. Takes the client as an argument so it is unit-tested.

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeVariantForSet } from './constants/cardVariants';

export type GotItWant = {
  id: string;
  card_id: string;
  set_id: string | null;
  card_name: string;
  card_number: string | null;
  image_url: string | null;
  set_name: string | null;
  quantity: number;
  priority: 'low' | 'medium' | 'high';
  note: string | null;
};

export type GotItReceipt = {
  want: GotItWant;
  variant: string;
  // False when the card was already owned: undo must not remove it from the binder.
  binderAdded: boolean;
};

export type GotItResult = { ok: true; receipt: GotItReceipt } | { ok: false; message: string };
export type UndoResult = { ok: true } | { ok: false; message: string };

const WANT_FIELDS = [
  'id',
  'card_id',
  'set_id',
  'card_name',
  'card_number',
  'image_url',
  'set_name',
  'quantity',
  'priority',
  'note',
] as const;

export async function gotIt(client: SupabaseClient, userId: string, want: GotItWant): Promise<GotItResult> {
  const variant = want.set_id ? normalizeVariantForSet(want.set_id, 'Normal') : 'Normal';
  const key = { user_id: userId, card_id: want.card_id, variant };

  const existing = await client.from('user_cards').select('owned').match(key);
  if (existing.error) return { ok: false, message: existing.error.message };
  const alreadyOwned = (existing.data ?? []).some((row: { owned?: boolean }) => row.owned);

  if (!alreadyOwned) {
    const add = await client
      .from('user_cards')
      .upsert(
        { user_id: userId, card_id: want.card_id, set_id: want.set_id, variant, owned: true },
        { onConflict: 'user_id,card_id,variant,set_id' }
      );
    if (add.error) return { ok: false, message: add.error.message };
  }

  const drop = await client.from('wishlist_cards').delete().eq('id', want.id);
  if (drop.error) {
    if (!alreadyOwned) await client.from('user_cards').delete().match(key);
    return { ok: false, message: drop.error.message };
  }
  return { ok: true, receipt: { want, variant, binderAdded: !alreadyOwned } };
}

export async function undoGotIt(client: SupabaseClient, userId: string, receipt: GotItReceipt): Promise<UndoResult> {
  const { want } = receipt;
  const row: Record<string, unknown> = { user_id: userId };
  for (const field of WANT_FIELDS) row[field] = want[field];
  const back = await client.from('wishlist_cards').insert(row);
  if (back.error) return { ok: false, message: back.error.message };

  if (receipt.binderAdded) {
    const gone = await client
      .from('user_cards')
      .delete()
      .match({ user_id: userId, card_id: want.card_id, variant: receipt.variant });
    if (gone.error) {
      // Keep both states consistent: take the want back out again.
      await client.from('wishlist_cards').delete().eq('id', want.id);
      return { ok: false, message: gone.error.message };
    }
  }
  return { ok: true };
}
