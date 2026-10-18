'use client';

import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';
import ClosedConversationNotice from './components/ClosedConversationNotice';
import ConversationHeader from './components/ConversationHeader';
import ConversationSkeleton from './components/ConversationSkeleton';
import ListingSidebar from './components/ListingSidebar';
import MessageComposer from './components/MessageComposer';
import MessageList from './components/MessageList';
import { useConversation } from './hooks/useConversation';
import { useConversationActions } from './hooks/useConversationActions';

export default function ConversationPage() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const routeParams = useParams<{ conversationId?: string | string[] }>();
  const conversationId = Array.isArray(routeParams.conversationId)
    ? routeParams.conversationId[0] ?? ''
    : routeParams.conversationId ?? '';

  const {
    loading,
    error,
    conversation,
    setConversation,
    messages,
    isParticipant,
    otherUserId,
    otherName,
    scrollRef,
  } = useConversation(conversationId);

  const {
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
  } = useConversationActions({
    conversationId,
    user,
    conversation,
    setConversation,
    otherUserId,
  });

  const activeListing = conversation?.trade_listings?.[0] ?? null;

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
          <ConversationSkeleton />
        ) : !conversation || !isParticipant ? (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 backdrop-blur">
            Conversation unavailable.
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <ConversationHeader conversation={conversation} activeListing={activeListing} />

              <section className="flex h-[60vh] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
                <MessageList
                  scrollRef={scrollRef}
                  messages={messages}
                  userId={user.id}
                  otherName={otherName}
                  onOfferDecision={handleOfferDecision}
                  onCounterOffer={startCounterOffer}
                  offerDecisionPending={offerDecisionPending}
                />

                {conversation.status === 'active' ? (
                  <MessageComposer
                    draft={draft}
                    setDraft={setDraft}
                    sending={sending}
                    onSend={sendTextMessage}
                    offerOpen={offerOpen}
                    setOfferOpen={setOfferOpen}
                    offerAmount={offerAmount}
                    setOfferAmount={setOfferAmount}
                    offerSending={offerSending}
                    onSendOffer={sendOffer}
                  />
                ) : (
                  <ClosedConversationNotice
                    status={conversation.status}
                    onMarkCompleted={markCompleted}
                    completing={completing}
                  />
                )}
              </section>
            </div>

            <ListingSidebar
              activeListing={activeListing}
              conversation={conversation}
              userId={user.id}
              otherName={otherName}
              onMarkListingSold={markListingSold}
              markingSold={markingSold}
              listingSold={listingSold}
            />
          </div>
        )}
      </div>
    </main>
  );
}
