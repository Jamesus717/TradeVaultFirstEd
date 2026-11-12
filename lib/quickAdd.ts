// What the binder's Quick add writes. Uses the old tables, so it works before the
// inventory migrations; their triggers carry the row across once applied.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardSearchResult } from '../app/trade/types';
import { normalizeVariantForSet, type CardVariantType } from './constants/cardVariants';

export type QuickAddTarget = 'owned' | 'wanted';

export type QuickAddResult = { ok: boolean; message: string; variant: CardVariantType };

export async function saveQuickAdd(
  client: SupabaseClient,
  userId: string,
  card: CardSearchResult,
  target: QuickAddTarget
): Promise<QuickAddResult> {
  const setId = card.set?.id ?? null;
  // The binder's own name for this printing, so one card is never two stacks.
  const variant = setId ? normalizeVariantForSet(setId, 'Normal') : 'Normal';

  const { error } =
    target === 'owned'
      ? await client
          .from('user_cards')
          .upsert(
            { user_id: userId, card_id: card.id, set_id: setId, variant, owned: true },
            { onConflict: 'user_id,card_id,variant,set_id' }
          )
      : await client.from('wishlist_cards').insert({
          user_id: userId,
          card_id: card.id,
          set_id: setId,
          card_name: card.name,
          card_number: card.number,
          image_url: card.images?.small ?? null,
          set_name: card.set?.name ?? null,
        });

  if (error) {
    return {
      ok: false,
      message: error.code === '23505' ? `${card.name} is already on your wishlist.` : error.message,
      variant,
    };
  }

  return {
    ok: true,
    message: target === 'owned' ? `Added ${card.name} to your binder.` : `Added ${card.name} to your wishlist.`,
    variant,
  };
}
