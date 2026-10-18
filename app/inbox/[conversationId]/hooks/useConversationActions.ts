'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabaseClient';
import type { Conversation, ConversationStatus, Message, OfferStatus } from '../types';

type UseConversationActionsParams = {
  conversationId: string;
  user: User | null;
  conversation: Conversation | null;
  setConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
  otherUserId: string | null;
};

export function useConversationActions({
  conversationId,
  user,
  conversation,
  setConversation,
  otherUserId,
}: UseConversationActionsParams) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSending, setOfferSending] = useState(false);

  // Accept/Decline, Mark as Completed and Mark as Sold each run several
  // sequential writes. They previously ran with no UI feedback at all, so the
  // button sat there looking untouched for the whole round trip and a second
  // click would start the work again. These flags drive the disabled state and
  // the in-flight label; they are UI only and change no write order.
  const [offerDecisionPending, setOfferDecisionPending] = useState<{
    messageId: string;
    decision: OfferStatus;
  } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [listingSold, setListingSold] = useState(false);

  async function notifyOther(type: string, message: string) {
    if (!user || !otherUserId || !supabase) {
      return;
    }
    await supabase.from('notifications').insert({
      user_id: otherUserId,
      type,
      conversation_id: conversationId,
      message,
    });
  }

  async function insertSystemMessage(content: string) {
    if (!supabase) {
      return;
    }
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: null,
      content,
      message_type: 'system',
    });
  }

  async function sendTextMessage() {
    if (!user || !supabase || !conversation) {
      return;
    }

    if (sending) {
      return;
    }

    const text = draft.trim();
    if (!text) {
      return;
    }

    if (conversation.status !== 'active') {
      return;
    }

    setSending(true);

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
      message_type: 'message',
    });

    if (!insertError) {
      setDraft('');
      await notifyOther('new_message', 'New message');
    }

    setSending(false);
  }

  async function sendOffer(amount: number) {
    if (!user || !supabase || !conversation) {
      return;
    }

    if (offerSending) {
      return;
    }

    if (conversation.status !== 'active') {
      return;
    }

    setOfferSending(true);

    const { error: offerError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: '',
      message_type: 'offer',
      offer_amount: amount,
      offer_status: 'pending',
    });

    if (!offerError) {
      setOfferAmount('');
      setOfferOpen(false);
      await notifyOther('new_offer', 'New offer');
    }

    setOfferSending(false);
  }

  async function handleOfferDecision(message: Message, decision: OfferStatus) {
    if (!user || !supabase || !conversation || message.message_type !== 'offer') {
      return;
    }

    const recipientId = message.sender_id && message.sender_id === user.id ? null : user.id;
    if (!recipientId) {
      return;
    }

    if (message.offer_status !== 'pending') {
      return;
    }

    if (offerDecisionPending) {
      return;
    }

    const nextConversationStatus: ConversationStatus =
      decision === 'accepted' ? 'accepted' : decision === 'declined' ? 'declined' : 'active';

    setOfferDecisionPending({ messageId: message.id, decision });

    try {
      await supabase.from('messages').update({ offer_status: decision }).eq('id', message.id);

      if (decision === 'accepted' || decision === 'declined') {
        await supabase.from('conversations').update({ status: nextConversationStatus }).eq('id', conversationId);
      }

      if (decision === 'accepted') {
        await insertSystemMessage('Offer accepted');
        await notifyOther('offer_accepted', 'Offer accepted');
      } else if (decision === 'declined') {
        await insertSystemMessage('Offer declined');
        await notifyOther('offer_declined', 'Offer declined');
      } else {
        await insertSystemMessage('Offer countered');
        await notifyOther('offer_countered', 'Offer countered');
      }

      if (decision === 'accepted' || decision === 'declined') {
        setConversation((current) => (current ? { ...current, status: nextConversationStatus } : current));
      }
    } finally {
      setOfferDecisionPending(null);
    }
  }

  // The "Counter" button on a pending offer only opens the composer's offer
  // box seeded with the offered amount — it does not write anything.
  function startCounterOffer(message: Message) {
    setOfferOpen(true);
    setOfferAmount(message.offer_amount ? String(message.offer_amount) : '');
  }

  async function markCompleted() {
    if (!user || !supabase || !conversation) {
      return;
    }

    if (conversation.status !== 'accepted') {
      return;
    }

    if (completing) {
      return;
    }

    setCompleting(true);

    try {
      await supabase.from('conversations').update({ status: 'completed' }).eq('id', conversationId);
      await insertSystemMessage('Trade marked as completed');
      await notifyOther('trade_completed', 'Trade completed');
      setConversation((current) => (current ? { ...current, status: 'completed' } : current));
    } finally {
      setCompleting(false);
    }
  }

  async function markListingSold() {
    const listing = conversation?.trade_listings?.[0] ?? null;
    if (!user || !supabase || !listing) {
      return;
    }

    if (listing.user_id !== user.id) {
      return;
    }

    if (markingSold || listingSold) {
      return;
    }

    setMarkingSold(true);

    try {
      await markListingSoldInner(listing.id);
    } finally {
      setMarkingSold(false);
    }
  }

  async function markListingSoldInner(listingId: string) {
    if (!user || !supabase) {
      return;
    }

    const { error: soldError } = await supabase
      .from('trade_listings')
      .update({ is_active: false })
      .eq('id', listingId);

    // Previously this button wrote and then showed nothing at all, so there was
    // no way to tell it had worked. Only latch the "sold" label when the write
    // that matters actually succeeded, so a rejected write leaves the button
    // enabled to retry rather than lying about the outcome.
    if (soldError) {
      return;
    }

    setListingSold(true);

    const { data: affectedConversations } = await supabase
      .from('conversations')
      .select('id,buyer_id,seller_id')
      .eq('listing_id', listingId)
      .eq('status', 'active');

    const affected = (affectedConversations ?? []) as Array<{ id: string; buyer_id: string; seller_id: string }>;

    if (affected.length > 0) {
      await supabase.from('conversations').update({ status: 'cancelled' }).in(
        'id',
        affected.map((c) => c.id)
      );

      await supabase.from('messages').insert(
        affected.map((c) => ({
          conversation_id: c.id,
          sender_id: null,
          content: 'Listing marked as sold',
          message_type: 'system',
        }))
      );

      const notifyRows = affected
        .filter((c) => c.buyer_id !== user.id)
        .map((c) => ({
          user_id: c.buyer_id,
          type: 'trade_completed',
          conversation_id: c.id,
          message: 'Listing marked as sold',
        }));

      if (notifyRows.length > 0) {
        await supabase.from('notifications').insert(notifyRows);
      }
    }
  }

  return {
    draft,
    setDraft,
    sending,
    sendTextMessage,
    offerOpen,
    setOfferOpen,
    offerAmount,
    setOfferAmount,
    offerSending,
    sendOffer,
    handleOfferDecision,
    offerDecisionPending,
    startCounterOffer,
    markCompleted,
    completing,
    markListingSold,
    markingSold,
    listingSold,
  };
}
