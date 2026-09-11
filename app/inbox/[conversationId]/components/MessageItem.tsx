'use client';

import type { Message, OfferStatus } from '../types';
import { classNames, formatMoneyGBP, formatTimeAgo } from '../utils';

export default function MessageItem({
  message,
  userId,
  otherName,
  onOfferDecision,
  onCounterOffer,
  offerDecisionPending,
}: {
  message: Message;
  userId: string;
  otherName: string;
  onOfferDecision: (message: Message, decision: OfferStatus) => void;
  onCounterOffer: (message: Message) => void;
  offerDecisionPending: { messageId: string; decision: OfferStatus } | null;
}) {
  if (message.message_type === 'system') {
    return (
      <div className="py-1 text-center text-xs italic text-stone-500">{message.content}</div>
    );
  }

  const own = message.sender_id === userId;
  const align = own ? 'items-end' : 'items-start';
  const bubbleBase = 'max-w-[75%] px-4 py-2.5 text-sm';

  if (message.message_type === 'offer') {
    const pending = message.offer_status === 'pending';
    const recipient = !own;

    // A decision anywhere in the thread locks every offer's buttons — the
    // writes are sequential and touch the shared conversation status, so a
    // second decision landing mid-flight is exactly what we want to prevent.
    const decisionBusy = offerDecisionPending !== null;
    const thisDecision =
      offerDecisionPending?.messageId === message.id ? offerDecisionPending.decision : null;

    return (
      <div className={classNames('flex flex-col gap-1', align)}>
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
                  onClick={() => onOfferDecision(message, 'accepted')}
                  disabled={decisionBusy}
                  className={classNames(
                    'rounded-2xl bg-primary-400 px-3 py-2 text-xs font-semibold text-primary-950 hover:bg-primary-300',
                    decisionBusy ? 'cursor-not-allowed opacity-60' : ''
                  )}
                >
                  {thisDecision === 'accepted' ? 'Accepting…' : 'Accept'}
                </button>
                <button
                  type="button"
                  onClick={() => onOfferDecision(message, 'declined')}
                  disabled={decisionBusy}
                  className={classNames(
                    'rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15',
                    decisionBusy ? 'cursor-not-allowed opacity-60' : ''
                  )}
                >
                  {thisDecision === 'declined' ? 'Declining…' : 'Decline'}
                </button>
                <button
                  type="button"
                  onClick={() => onCounterOffer(message)}
                  disabled={decisionBusy}
                  className={classNames(
                    'rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20',
                    decisionBusy ? 'cursor-not-allowed opacity-60' : ''
                  )}
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
    <div className={classNames('flex flex-col gap-1', align)}>
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
}
