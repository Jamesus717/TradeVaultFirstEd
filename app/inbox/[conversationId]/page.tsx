'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';

type ConversationStatus = 'active' | 'accepted' | 'declined' | 'completed' | 'cancelled';
type MessageType = 'message' | 'offer' | 'system';
type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';

type ListingType = 'trade' | 'sale' | 'either';
type ListingCondition =
  | 'Mint'
  | 'Near Mint'
  | 'Lightly Played'
  | 'Moderately Played'
  | 'Heavily Played';

type Listing = {
  id: string;
  user_id: string;
  card_name: string;
  set_name: string;
  set_id: string;
  card_number: string;
  variant: string;
  condition: ListingCondition;
  listing_type: ListingType;
  price: number | null;
  trade_description: string | null;
  postcode_prefix: string | null;
  image_url: string | null;
  card_image_url: string | null;
  is_active: boolean;
};

type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
  trade_listings: Listing[] | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  message_type: MessageType;
  offer_amount: number | null;
  offer_status: OfferStatus | null;
  created_at: string;
  read_at: string | null;
};

type PublicProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatMoneyGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatTimeAgo(iso: string) {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return '';
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - created) / 1000));

  if (diffSeconds < 20) {
    return 'just now';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function statusBadge(status: ConversationStatus) {
  if (status === 'active') {
    return { label: 'ACTIVE', className: 'border-primary-300/20 bg-primary-400/10 text-primary-200' };
  }

  if (status === 'accepted') {
    return { label: 'ACCEPTED', className: 'border-primary-300/20 bg-primary-400/10 text-primary-200' };
  }

  if (status === 'completed') {
    return { label: 'COMPLETED', className: 'border-primary-300/20 bg-primary-400/10 text-primary-200' };
  }

  if (status === 'declined') {
    return { label: 'DECLINED', className: 'border-rose-300/20 bg-rose-500/10 text-rose-200' };
  }

  return { label: 'CANCELLED', className: 'border-rose-300/20 bg-rose-500/10 text-rose-200' };
}

function conditionBadgeClass(condition: ListingCondition) {
  if (condition === 'Mint' || condition === 'Near Mint') {
    return 'bg-primary-400/90 text-primary-950';
  }

  if (condition === 'Lightly Played') {
    return 'bg-amber-400/90 text-amber-950';
  }

  return 'bg-rose-400/90 text-rose-950';
}

function listingTypeBadge(listingType: ListingType) {
  if (listingType === 'trade') {
    return { label: 'TRADE', className: 'bg-blue-400/90 text-blue-950' };
  }

  if (listingType === 'sale') {
    return { label: 'SALE', className: 'bg-primary-400/90 text-primary-950' };
  }

  return { label: 'TRADE OR SALE', className: 'bg-purple-400/90 text-purple-950' };
}

function shortId(value: string) {
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function ConversationPage() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const routeParams = useParams<{ conversationId?: string | string[] }>();
  const conversationId = Array.isArray(routeParams.conversationId)
    ? routeParams.conversationId[0] ?? ''
    : routeParams.conversationId ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, PublicProfile | undefined>>({});

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSending, setOfferSending] = useState(false);

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

      const { data: conv, error: convError } = await client
        .from('conversations')
        .select(
          'id,listing_id,buyer_id,seller_id,status,created_at,updated_at,trade_listings(id,user_id,card_name,set_name,set_id,card_number,variant,condition,listing_type,price,trade_description,postcode_prefix,image_url,card_image_url,is_active)'
        )
        .eq('id', conversationId)
        .maybeSingle();

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

      const { data: msgData, error: msgError } = await client
        .from('messages')
        .select('id,conversation_id,sender_id,content,message_type,offer_amount,offer_status,created_at,read_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!active) {
        return;
      }

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

      await Promise.all([
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
      ]);

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

    const nextConversationStatus: ConversationStatus =
      decision === 'accepted' ? 'accepted' : decision === 'declined' ? 'declined' : 'active';

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
  }

  async function markCompleted() {
    if (!user || !supabase || !conversation) {
      return;
    }

    if (conversation.status !== 'accepted') {
      return;
    }

    await supabase.from('conversations').update({ status: 'completed' }).eq('id', conversationId);
    await insertSystemMessage('Trade marked as completed');
    await notifyOther('trade_completed', 'Trade completed');
    setConversation((current) => (current ? { ...current, status: 'completed' } : current));
  }

  async function markListingSold() {
    const listing = conversation?.trade_listings?.[0] ?? null;
    if (!user || !supabase || !listing) {
      return;
    }

    if (listing.user_id !== user.id) {
      return;
    }

    await supabase.from('trade_listings').update({ is_active: false }).eq('id', listing.id);

    const { data: affectedConversations } = await supabase
      .from('conversations')
      .select('id,buyer_id,seller_id')
      .eq('listing_id', listing.id)
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

  const activeListing = conversation?.trade_listings?.[0] ?? null;

  const header = (
    <div className="mb-4 flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <Link href="/inbox" className="text-sm font-medium text-stone-300 hover:text-white">
        ← Back
      </Link>
      <div className="h-10 w-10 overflow-hidden rounded-lg bg-stone-900 ring-1 ring-white/5">
        {activeListing?.image_url || activeListing?.card_image_url ? (
          <Image
            src={activeListing?.image_url ?? activeListing?.card_image_url ?? ''}
            alt={activeListing?.card_name ?? 'Listing'}
            width={80}
            height={112}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-stone-600">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {activeListing?.card_name ?? 'Conversation'}
        </p>
        <p className="truncate text-xs text-stone-400">
          {activeListing?.set_name ?? 'Unknown set'} · #{activeListing?.card_number ?? '--'}
        </p>
      </div>
      {conversation ? (
        <span
          className={classNames(
            'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
            statusBadge(conversation.status).className
          )}
        >
          {statusBadge(conversation.status).label}
        </span>
      ) : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {authLoading ? (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 backdrop-blur">
            Checking your session...
          </section>
        ) : !user ? (
          <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-4 text-center text-sm text-amber-200/80">
            Sign in to view conversations.
          </section>
        ) : supabaseDisabled || !supabase ? (
          <section className="rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-6 text-center text-sm text-amber-200/80">
            Supabase is not configured for this app.
          </section>
        ) : error ? (
          <section className="rounded-[1.5rem] border border-rose-300/20 bg-rose-500/10 p-6 text-sm text-rose-100 backdrop-blur">
            {error}
          </section>
        ) : loading ? (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 backdrop-blur">
            Loading conversation...
          </section>
        ) : !conversation || !isParticipant ? (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 backdrop-blur">
            Conversation unavailable.
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              {header}

              <section className="flex h-[60vh] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
                  {messages.map((message) => {
                    if (message.message_type === 'system') {
                      return (
                        <div key={message.id} className="py-1 text-center text-xs italic text-stone-500">
                          {message.content}
                        </div>
                      );
                    }

                    const own = message.sender_id === user.id;
                    const align = own ? 'items-end' : 'items-start';
                    const bubbleBase = 'max-w-[75%] px-4 py-2.5 text-sm';

                    if (message.message_type === 'offer') {
                      const pending = message.offer_status === 'pending';
                      const recipient = !own;

                      return (
                        <div key={message.id} className={classNames('flex flex-col gap-1', align)}>
                          <div
                            className={classNames(
                              'max-w-[85%] rounded-[1.25rem] border border-amber-300/20 bg-amber-400/5 p-4',
                              own ? 'rounded-br-sm' : 'rounded-bl-sm'
                            )}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                              Price Offer
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-white">
                              {message.offer_amount ? formatMoneyGBP(message.offer_amount) : ''}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {pending && recipient ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOfferDecision(message, 'accepted')}
                                    className="rounded-2xl bg-primary-400 px-3 py-2 text-xs font-semibold text-primary-950 hover:bg-primary-300"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOfferDecision(message, 'declined')}
                                    className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOfferOpen(true);
                                      setOfferAmount(message.offer_amount ? String(message.offer_amount) : '');
                                    }}
                                    className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20"
                                  >
                                    Counter
                                  </button>
                                </>
                              ) : (
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-200">
                                  {message.offer_status ?? 'pending'}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-stone-500">
                            {own ? 'You' : otherName} · {formatTimeAgo(message.created_at)}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div key={message.id} className={classNames('flex flex-col gap-1', align)}>
                        <div
                          className={classNames(
                            bubbleBase,
                            'rounded-[1.25rem] border',
                            own
                              ? 'rounded-br-sm border-primary-400/20 bg-primary-400/20 text-white'
                              : 'rounded-bl-sm border-white/10 bg-white/[0.05] text-stone-100'
                          )}
                        >
                          {message.content}
                        </div>
                        <p className="text-[10px] text-stone-500">
                          {own ? 'You' : otherName} · {formatTimeAgo(message.created_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {conversation.status === 'active' ? (
                  <div className="border-t border-white/10 p-4">
                    {offerOpen ? (
                      <div className="mb-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/80">
                          Make Offer
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-stone-300">
                            £
                          </div>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={offerAmount}
                            onChange={(event) => setOfferAmount(event.target.value)}
                            placeholder="Amount"
                            className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOfferOpen(false);
                              setOfferAmount('');
                            }}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/[0.06]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const amount = Number.parseFloat(offerAmount);
                              if (amount > 0) {
                                sendOffer(amount);
                              }
                            }}
                            disabled={offerSending || !offerAmount.trim()}
                            className={classNames(
                              'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                              offerSending || !offerAmount.trim()
                                ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                                : 'bg-amber-400 text-amber-950 hover:bg-amber-300'
                            )}
                          >
                            {offerSending ? 'Sending…' : 'Send Offer'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-end gap-3">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Type a message..."
                        rows={1}
                        className="min-h-[52px] w-full resize-none rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            sendTextMessage();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setOfferOpen(true)}
                        className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200 hover:bg-amber-400/20"
                      >
                        Make Offer
                      </button>
                      <button
                        type="button"
                        onClick={sendTextMessage}
                        disabled={sending || !draft.trim()}
                        className={classNames(
                          'rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
                          sending || !draft.trim()
                            ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                            : 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                        )}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-white/10 p-4 text-center text-sm text-stone-300">
                    {conversation.status === 'accepted' ? (
                      <div className="space-y-3">
                        <p>Offer accepted. Mark this trade as completed when you’re done.</p>
                        <button
                          type="button"
                          onClick={markCompleted}
                          className="inline-flex rounded-2xl bg-primary-400 px-4 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300"
                        >
                          Mark as Completed
                        </button>
                      </div>
                    ) : (
                      <p>This conversation is {conversation.status}.</p>
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside className="h-fit space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Listing</p>
              <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-stone-900">
                <div className="relative aspect-[3/4]">
                  {activeListing?.image_url || activeListing?.card_image_url ? (
                    <Image
                      src={activeListing?.image_url ?? activeListing?.card_image_url ?? ''}
                      alt={activeListing?.card_name ?? 'Listing'}
                      fill
                      sizes="320px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-stone-600">
                      No image
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-base font-semibold text-white">{activeListing?.card_name}</p>
                <p className="text-xs text-stone-400">
                  {activeListing?.set_name} · #{activeListing?.card_number} · {activeListing?.variant}
                </p>
              </div>

              {activeListing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={classNames(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                      conditionBadgeClass(activeListing.condition)
                    )}
                  >
                    {activeListing.condition}
                  </span>
                  <span
                    className={classNames(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                      listingTypeBadge(activeListing.listing_type).className
                    )}
                  >
                    {listingTypeBadge(activeListing.listing_type).label}
                  </span>
                </div>
              ) : null}

              {activeListing?.listing_type !== 'trade' && activeListing?.price ? (
                <p className="text-lg font-semibold text-primary-400">
                  {formatMoneyGBP(activeListing.price)}
                </p>
              ) : null}

              {activeListing?.trade_description ? (
                <p className="text-sm text-stone-300">{activeListing.trade_description}</p>
              ) : null}

              {activeListing?.postcode_prefix ? (
                <p className="text-xs text-stone-400">
                  <span className="mr-1">📍</span>
                  {activeListing.postcode_prefix} area
                </p>
              ) : null}

              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Seller</p>
                <p className="mt-2 text-sm text-stone-200">
                  {conversation.seller_id === user.id ? 'You' : otherName}
                </p>
              </div>

              {activeListing?.user_id === user.id ? (
                <button
                  type="button"
                  onClick={markListingSold}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-stone-100 hover:bg-white/[0.06]"
                >
                  Mark as Sold
                </button>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
