// "Add N missing to wishlist" on the Set Progress card (B60). Uses the existing
// wishlist_cards insert only (no new tables). Cards already wanted, or owned in
// any printing, are skipped. Nothing is overwritten: only new rows are inserted,
// so Undo can delete exactly what this tap added.

import type { SupabaseClient } from '@supabase/supabase-js';

export type MissingCard = {
  id: string;
  baseCardId: string;
  setId: string;
  setName: string;
  name: string;
  number: string;
  image: string;
};

export type MissingReceipt = { cardIds: string[] };
export type AddMissingResult =
  | { ok: true; receipt: MissingReceipt; added: number }
  | { ok: false; message: string };
export type UndoMissingResult = { ok: true } | { ok: false; message: string };

const CHUNK = 100;

// Unique cards (the wishlist holds one row per card, not per printing) that are
// not owned in any printing and not already wanted.
export function pickMissing(
  cards: MissingCard[],
  owned: Record<string, boolean>,
  wanted: ReadonlySet<string>
): MissingCard[] {
  const ownedBase = new Set<string>();
  for (const card of cards) if (owned[card.id]) ownedBase.add(card.baseCardId);
  const seen = new Set<string>();
  const picked: MissingCard[] = [];
  for (const card of cards) {
    const key = card.baseCardId;
    if (seen.has(key) || ownedBase.has(key) || wanted.has(key)) continue;
    seen.add(key);
    picked.push(card);
  }
  return picked;
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

export async function addMissingToWants(
  client: SupabaseClient,
  userId: string,
  cards: MissingCard[]
): Promise<AddMissingResult> {
  const ids = cards.map((c) => c.baseCardId);
  // Re-check just before writing: a want added elsewhere meanwhile is left alone.
  const already = new Set<string>();
  for (const part of chunks(ids)) {
    const { data, error } = await client
      .from('wishlist_cards')
      .select('card_id')
      .eq('user_id', userId)
      .in('card_id', part);
    if (error) return { ok: false, message: error.message };
    for (const row of (data ?? []) as { card_id: string }[]) already.add(row.card_id);
  }
  const fresh = cards.filter((c) => !already.has(c.baseCardId));
  if (fresh.length === 0) return { ok: true, receipt: { cardIds: [] }, added: 0 };

  const inserted: string[] = [];
  for (const part of chunks(fresh)) {
    const { error } = await client.from('wishlist_cards').insert(
      part.map((c) => ({
        user_id: userId,
        card_id: c.baseCardId,
        set_id: c.setId || null,
        card_name: c.name,
        card_number: c.number,
        image_url: c.image || null,
        set_name: c.setName || null,
      }))
    );
    if (error) {
      // Roll back what earlier chunks added so nothing is half-done.
      const undone = await undoMissingToWants(client, userId, { cardIds: inserted });
      return {
        ok: false,
        message: undone.ok ? error.message : `${error.message}. Also could not undo: ${undone.message}`,
      };
    }
    inserted.push(...part.map((c) => c.baseCardId));
  }
  return { ok: true, receipt: { cardIds: inserted }, added: inserted.length };
}

export async function undoMissingToWants(
  client: SupabaseClient,
  userId: string,
  receipt: MissingReceipt
): Promise<UndoMissingResult> {
  for (const part of chunks(receipt.cardIds)) {
    const { error } = await client.from('wishlist_cards').delete().eq('user_id', userId).in('card_id', part);
    if (error) return { ok: false, message: error.message };
  }
  return { ok: true };
}
