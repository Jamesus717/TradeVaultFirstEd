'use client';

import type { RefObject } from 'react';
import type { Message, OfferStatus } from '../types';
import MessageItem from './MessageItem';

export default function MessageList({
  scrollRef,
  messages,
  userId,
  otherName,
  onOfferDecision,
  onCounterOffer,
  offerDecisionPending,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: Message[];
  userId: string;
  otherName: string;
  onOfferDecision: (message: Message, decision: OfferStatus) => void;
  onCounterOffer: (message: Message) => void;
  offerDecisionPending: { messageId: string; decision: OfferStatus } | null;
}) {
  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          userId={userId}
          otherName={otherName}
          onOfferDecision={onOfferDecision}
          onCounterOffer={onCounterOffer}
          offerDecisionPending={offerDecisionPending}
        />
      ))}
    </div>
  );
}
