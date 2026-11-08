'use client';

import { useEffect, useState } from 'react';
import { demoMode } from '../../../../lib/demo';
import { DEMO_MY_CARDS } from '../../../../lib/demoPrices';
import { setsToName, toPickable, type CardName, type OwnedRow, type PickableCard } from '../../../../lib/myCards';
import { supabase } from '../../../../lib/supabaseClient';

type SetCardsResponse = { data?: Array<{ id: string; name: string; number?: string; images?: { small?: string } }> };

async function namesFor(sets: string[]): Promise<Record<string, CardName>> {
  const names: Record<string, CardName> = {};
  await Promise.all(
    sets.map(async (setId) => {
      try {
        const res = await fetch(`/api/pokemon/cards?setId=${encodeURIComponent(setId)}`);
        if (!res.ok) return;
        const body = (await res.json()) as SetCardsResponse;
        for (const card of body.data ?? []) {
          names[card.id] = { name: card.name, number: card.number ?? null, image: card.images?.small ?? null };
        }
      } catch {
        // No name is fine: the picker falls back to the set and number.
      }
    })
  );
  return names;
}

// The signed-in user's owned cards, loaded the first time the picker opens.
export function useMyCards(userId: string | null, open: boolean) {
  const [state, setState] = useState<{ cards: PickableCard[]; error: string } | null>(null);

  useEffect(() => {
    if (!open || state || demoMode || !userId || !supabase) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('card_id, variant, set_id')
        .eq('user_id', userId)
        .eq('owned', true)
        .limit(2000);
      if (!active) return;
      if (error || !data) {
        setState({ cards: [], error: 'Could not load your cards.' });
        return;
      }
      const rows = data as OwnedRow[];
      const names = await namesFor(setsToName(rows));
      if (active) setState({ cards: toPickable(rows, names), error: '' });
    })();
    return () => {
      active = false;
    };
  }, [open, state, userId]);

  if (demoMode) {
    const names = Object.fromEntries(DEMO_MY_CARDS.map((card) => [card.card_id, card]));
    return { cards: toPickable(DEMO_MY_CARDS, names), loading: false, error: '' };
  }
  return { cards: state?.cards ?? [], loading: open && !state, error: state?.error ?? '' };
}
