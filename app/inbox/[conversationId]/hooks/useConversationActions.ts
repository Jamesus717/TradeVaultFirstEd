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
};

export function useConversationActions({
  conversationId,
  user,
  conversation,
  setConversation,
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

  // System messages, notifications and the conversation status that follows
  // an offer decision are written by database triggers (migration 016), so
  // each action here is a single write.

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
      const { error: decisionError } = await supabase
        .from('messages')
        .update({ offer_status: decision })
        .eq('id', message.id);

      if (!decisionError && (decision === 'accepted' || decision === 'declined')) {
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
      const { error: completeError } = await supabase
        .from('conversations')
        .update({ status: 'completed' })
        .eq('id', conversationId);

      if (!completeError) {
        setConversation((current) => (current ? { ...current, status: 'completed' } : current));
      }
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

    // Deactivating the listing cancels its other open conversations and
    // notifies those buyers in the database (on_listing_deactivated).
    setListingSold(true);
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
