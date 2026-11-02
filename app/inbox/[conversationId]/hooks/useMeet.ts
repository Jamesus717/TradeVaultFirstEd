'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadShops, type Shop } from '../../../../lib/shops';
import { supabase } from '../../../../lib/supabaseClient';
import type { MeetState } from '../components/MeetPanel';

// Read apart from the conversation query, so that query keeps working on a
// database without migration 021. `meet` stays null there and the panel hides.
export function useMeet(conversationId: string) {
  const [meet, setMeet] = useState<MeetState | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !conversationId) {
      return;
    }

    const { data, error: loadError } = await supabase
      .from('conversations')
      .select('meet_shop_id, meet_at, meet_proposed_by, meet_status')
      .eq('id', conversationId)
      .maybeSingle();

    setMeet(loadError ? null : (data as MeetState | null));
  }, [conversationId]);

  useEffect(() => {
    const handle = setTimeout(refresh, 0);
    loadShops().then(setShops).catch(() => setShops([]));
    return () => clearTimeout(handle);
  }, [refresh]);

  async function run(name: string, args: Record<string, unknown>) {
    if (!supabase) {
      return;
    }

    setPending(true);
    setError('');
    const { error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) {
      setError(rpcError.message);
    }
    await refresh();
    setPending(false);
  }

  return {
    meet,
    shops,
    pending,
    error,
    propose: (shopId: string, meetAt: string | null) =>
      run('propose_meet', { p_conversation_id: conversationId, p_shop_id: shopId, p_meet_at: meetAt }),
    respond: (agree: boolean) =>
      run('respond_meet', {
        p_conversation_id: conversationId,
        p_agree: agree,
        p_shop_id: meet?.meet_shop_id,
        p_meet_at: meet?.meet_at,
      }),
  };
}
