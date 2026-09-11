'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useAuth } from '../../../auth';
import type { Conversation, ConversationStatus, Message, PublicProfile } from '../types';
import { CONVERSATION_COLUMNS, MESSAGE_COLUMNS, shortId } from '../utils';

export function useConversation(conversationId: string) {
  const { user, supabaseDisabled } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, PublicProfile | undefined>>({});

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isParticipant = useMemo(() => {
    if (!user || !conversation) {
      return false;
    }
    return user.id === conversation.buyer_id || user.id === conversation.seller_id;
  }, [conversation, user]);

  const otherUserId = useMemo(() => {
    if (!conversation || !user) {
      return null;
    }
    return conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
  }, [conversation, user]);

  const otherName = useMemo(() => {
    if (!otherUserId) {
      return '';
    }
    const profile = profilesByUserId[otherUserId];
    return profile?.display_name ?? profile?.username ?? shortId(otherUserId);
  }, [otherUserId, profilesByUserId]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    async function loadConversation() {
      const client = supabase;
      if (!user || supabaseDisabled || !client) {
        setConversation(null);
        setMessages([]);
        setProfilesByUserId({});
        return;
      }

      setLoading(true);
      setError('');

      // The messages query is keyed on the conversation id from the URL, so
      // it never needed the conversation row first. Running the two together
      // takes a round trip off the critical path. Access is still enforced
      // by the "Participants can view messages" RLS policy, and the client
      // check below still runs before anything is shown.
      const [
        { data: conv, error: convError },
        { data: msgData, error: msgError },
      ] = await Promise.all([
        client
          .from('conversations')
          .select(CONVERSATION_COLUMNS)
          .eq('id', conversationId)
          .maybeSingle(),
        client
          .from('messages')
          .select(MESSAGE_COLUMNS)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ]);

      if (!active) {
        return;
      }

      if (convError || !conv) {
        setError(convError?.message ?? 'Conversation not found.');
        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      const typedConv = conv as Conversation;
      if (typedConv.buyer_id !== user.id && typedConv.seller_id !== user.id) {
        setError('You do not have access to this conversation.');
        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      setConversation(typedConv);

      if (msgError) {
        setError(msgError.message);
        setMessages([]);
        setLoading(false);
        return;
      }

      setMessages((msgData ?? []) as Message[]);

      const otherIds = Array.from(
        new Set([typedConv.buyer_id, typedConv.seller_id].filter((id) => id && id !== user.id))
      );

      if (otherIds.length > 0) {
        const { data: profiles } = await client
          .from('public_profiles')
          .select('user_id,username,display_name')
          .in('user_id', otherIds);

        if (active) {
          const profileMap: Record<string, PublicProfile | undefined> = {};
          (profiles ?? []).forEach((profile) => {
            const row = profile as PublicProfile;
            profileMap[row.user_id] = row;
          });
          setProfilesByUserId(profileMap);
        }
      }

      // Marking things read is housekeeping — nothing on screen depends on
      // it, and awaiting it held the loading state open for a whole extra
      // round trip. Fire it off and carry on.
      void Promise.all([
        client
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id)
          .is('read_at', null),
        client
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('conversation_id', conversationId)
          .eq('read', false),
      ]).catch(() => {
        // Best effort: a failed read receipt must not surface as an
        // unhandled rejection now that nothing awaits it.
      });

      channel = client
        .channel(`conversation-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const next = payload.new as Message;
            setMessages((current) => {
              if (current.some((msg) => msg.id === next.id)) {
                return current;
              }
              return [...current, next];
            });

            if (next.sender_id && next.sender_id !== user.id) {
              client
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', next.id)
                .is('read_at', null);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const next = payload.new as Message;
            setMessages((current) => current.map((msg) => (msg.id === next.id ? { ...msg, ...next } : msg)));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `id=eq.${conversationId}`,
          },
          (payload) => {
            const next = payload.new as { status?: ConversationStatus; updated_at?: string };
            setConversation((current) =>
              current
                ? {
                    ...current,
                    status: next.status ?? current.status,
                    updated_at: next.updated_at ?? current.updated_at,
                  }
                : current
            );
          }
        )
        .subscribe();

      setLoading(false);
    }

    loadConversation();

    return () => {
      active = false;
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversationId, supabaseDisabled, user]);

  return {
    loading,
    error,
    conversation,
    setConversation,
    messages,
    isParticipant,
    otherUserId,
    otherName,
    scrollRef,
  };
}
