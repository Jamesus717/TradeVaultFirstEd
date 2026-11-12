'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DEMO_UNREAD_MESSAGES, demoMode } from '../../../lib/demo';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';

// Unread messages from other people, across all of the user's conversations.
// Row level security already limits messages to the user's own chats. This is
// the Messages badge; notifications are a separate thing and are not counted.
export function useUnreadMessages() {
  const { user, supabaseDisabled } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState({ userId: '', count: 0 });

  useEffect(() => {
    if (demoMode || !user || supabaseDisabled || !supabase) {
      return;
    }
    const client = supabase;
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      const { count, error } = await client
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .neq('sender_id', user!.id);
      if (active && !error) {
        setState({ userId: user!.id, count: count ?? 0 });
      }
    }

    function schedule() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(refresh, 250);
    }

    refresh();

    // A new message also raises a notification row for the user, which is
    // the one change we can filter to them.
    const channel = client
      .channel(`unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        schedule
      )
      .subscribe();

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      client.removeChannel(channel);
    };
    // Reading a chat marks messages read, so recount on navigation too.
  }, [pathname, supabaseDisabled, user]);

  if (demoMode) {
    return DEMO_UNREAD_MESSAGES;
  }
  return user && state.userId === user.id ? state.count : 0;
}
