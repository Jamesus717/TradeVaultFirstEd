'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

type ConversationStatus = 'active' | 'accepted' | 'declined' | 'completed' | 'cancelled';

type Listing = {
  id: string;
  user_id: string;
  card_name: string;
  set_name: string;
  card_number: string;
  variant: string;
  condition: string;
  listing_type: string;
  price: number | null;
  trade_description: string | null;
  postcode_prefix: string | null;
  image_url: string | null;
  card_image_url: string | null;
  created_at?: string;
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
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  message_type: 'message' | 'offer' | 'system';
  offer_amount: number | null;
  offer_status: 'pending' | 'accepted' | 'declined' | 'countered' | null;
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
    return null;
  }

  if (status === 'accepted' || status === 'completed') {
    return { label: status.toUpperCase(), className: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' };
  }

  return { label: status.toUpperCase(), className: 'border-rose-300/20 bg-rose-500/10 text-rose-200' };
}

function shortId(value: string) {
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function InboxPage() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [latestByConversation, setLatestByConversation] = useState<Record<string, Message | undefined>>({});
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, PublicProfile | undefined>>({});

  useEffect(() => {
    let active = true;

    async function loadInbox() {
      if (!user || supabaseDisabled || !supabase) {
        setConversations([]);
        setLatestByConversation({});
        setUnreadByConversation({});
        setProfilesByUserId({});
        return;
      }

      setLoading(true);
      setError('');

      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);

      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(
          'id,listing_id,buyer_id,seller_id,status,created_at,updated_at,trade_listings(id,user_id,card_name,set_name,card_number,variant,condition,listing_type,price,trade_description,postcode_prefix,image_url,card_image_url)'
        )
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (convError) {
        if (active) {
          setError(convError.message);
          setConversations([]);
        }
        setLoading(false);
        return;
      }

      const convs = (convData ?? []) as Conversation[];
      if (!active) {
        return;
      }

      setConversations(convs);

      const ids = convs.map((c) => c.id);
      if (ids.length === 0) {
        setLatestByConversation({});
        setUnreadByConversation({});
        setProfilesByUserId({});
        setLoading(false);
        return;
      }

      const otherIds = Array.from(
        new Set(
          convs.map((c) => (c.buyer_id === user.id ? c.seller_id : c.buyer_id)).filter(Boolean)
        )
      );

      const [{ data: messagesData, error: msgError }, { data: profilesData }] = await Promise.all([
        supabase
          .from('messages')
          .select('conversation_id,sender_id,content,message_type,offer_amount,offer_status,created_at,read_at')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })
          .limit(300),
        otherIds.length > 0
          ? supabase.from('public_profiles').select('user_id,username,display_name').in('user_id', otherIds)
          : Promise.resolve({ data: [] as PublicProfile[] }),
      ]);

      if (!active) {
        return;
      }

      if (msgError) {
        setError(msgError.message);
        setLatestByConversation({});
        setUnreadByConversation({});
        setProfilesByUserId({});
        setLoading(false);
        return;
      }

      const latestMap: Record<string, Message | undefined> = {};
      const unreadMap: Record<string, number> = {};

      (messagesData ?? []).forEach((row) => {
        const msg = row as Message;
        if (!latestMap[msg.conversation_id]) {
          latestMap[msg.conversation_id] = msg;
        }
        if (msg.sender_id && msg.sender_id !== user.id && !msg.read_at) {
          unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] ?? 0) + 1;
        }
      });

      const profileMap: Record<string, PublicProfile | undefined> = {};
      (profilesData ?? []).forEach((profile) => {
        profileMap[profile.user_id] = profile as PublicProfile;
      });

      setLatestByConversation(latestMap);
      setUnreadByConversation(unreadMap);
      setProfilesByUserId(profileMap);
      setLoading(false);
    }

    loadInbox();

    return () => {
      active = false;
    };
  }, [supabaseDisabled, user]);

  const hero = (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
        <h1 className="text-4xl font-semibold text-white">Inbox</h1>
        <p className="mt-2 text-sm text-stone-400">Your trade conversations and offers.</p>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {hero}

        {authLoading ? (
          <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 backdrop-blur">
            Checking your session...
          </section>
        ) : !user ? (
          <section className="mt-6 rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-4 text-center text-sm text-amber-200/80">
            Sign in to view your trade conversations and offers.
          </section>
        ) : supabaseDisabled || !supabase ? (
          <section className="mt-6 rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-6 text-center text-sm text-amber-200/80">
            Supabase is not configured for this app.
          </section>
        ) : error ? (
          <section className="mt-6 rounded-[1.5rem] border border-rose-300/20 bg-rose-500/10 p-6 text-sm text-rose-100 backdrop-blur">
            {error}
          </section>
        ) : loading ? (
          <section className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`s-${index}`}
                className="h-[92px] animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
              />
            ))}
          </section>
        ) : conversations.length === 0 ? (
          <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur">
            <div className="text-5xl">💬</div>
            <h2 className="mt-4 text-2xl font-semibold text-white">No conversations yet</h2>
            <p className="mt-2 text-sm text-stone-400">
              When you express interest in a listing or someone contacts you about yours, it will appear here.
            </p>
            <Link
              href="/trade"
              className="mt-6 inline-flex rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-300"
            >
              Browse Trade Board
            </Link>
          </section>
        ) : (
          <section className="mt-6 space-y-3">
            {conversations.map((conversation) => {
              const listing = conversation.trade_listings?.[0] ?? null;
              const image = listing?.image_url ?? listing?.card_image_url ?? '';
              const latest = latestByConversation[conversation.id];
              const otherId = conversation.buyer_id === user!.id ? conversation.seller_id : conversation.buyer_id;
              const profile = profilesByUserId[otherId];
              const otherName = profile?.display_name ?? profile?.username ?? shortId(otherId);
              const unread = (unreadByConversation[conversation.id] ?? 0) > 0;
              const badge = statusBadge(conversation.status);

              const previewText =
                latest?.message_type === 'offer'
                  ? `Offer: £${latest.offer_amount ?? ''} · ${latest.offer_status ?? ''}`
                  : latest?.message_type === 'system'
                    ? latest.content ?? ''
                    : latest?.content ?? '';

              return (
                <Link
                  key={conversation.id}
                  href={`/inbox/${conversation.id}`}
                  className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05]"
                >
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-900 ring-1 ring-white/5">
                    {image ? (
                      <Image
                        src={image}
                        alt={listing?.card_name ?? 'Listing'}
                        width={112}
                        height={160}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-stone-500">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {listing?.card_name ?? 'Listing'}
                    </p>
                    <p className="truncate text-xs text-stone-400">
                      {listing?.set_name ?? 'Unknown set'} · #{listing?.card_number ?? '--'}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-400">
                      With <span className="text-stone-200">{otherName}</span>
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs italic text-stone-500">{previewText}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs text-stone-500">{formatTimeAgo(conversation.updated_at)}</p>
                    <div className="flex items-center gap-2">
                      {badge ? (
                        <span
                          className={classNames(
                            'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                      {unread ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
