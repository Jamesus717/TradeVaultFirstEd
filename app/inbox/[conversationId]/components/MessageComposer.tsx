'use client';

import type { ReactNode } from 'react';
import { classNames } from '../utils';

export default function MessageComposer({
  draft,
  setDraft,
  sending,
  onSend,
  offerOpen,
  setOfferOpen,
  offerAmount,
  setOfferAmount,
  offerSending,
  onSendOffer,
  cardOfferOpen = false,
  setCardOfferOpen,
  cardOfferPanel,
}: {
  draft: string;
  setDraft: (value: string) => void;
  sending: boolean;
  onSend: () => void;
  offerOpen: boolean;
  setOfferOpen: (value: boolean) => void;
  offerAmount: string;
  setOfferAmount: (value: string) => void;
  offerSending: boolean;
  onSendOffer: (amount: number) => void;
  cardOfferOpen?: boolean;
  // Omit to hide the "Offer cards" button.
  setCardOfferOpen?: (value: boolean) => void;
  // The picker, rendered above the text box while open.
  cardOfferPanel?: ReactNode;
}) {
  return (
    <div className="border-t border-white/10 p-4">
      {offerOpen ? (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-amber-200/80">
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
                  onSendOffer(amount);
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

      {cardOfferOpen ? cardOfferPanel : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message..."
          rows={1}
          className="min-h-[52px] w-full resize-none rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <div className="flex gap-2 sm:contents">
          {setCardOfferOpen ? (
            <button
              type="button"
              onClick={() => {
                setOfferOpen(false);
                setCardOfferOpen(!cardOfferOpen);
              }}
              aria-expanded={cardOfferOpen}
              className="flex-1 whitespace-nowrap rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-200 hover:bg-sky-400/20 sm:flex-none"
            >
              Offer cards
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setCardOfferOpen?.(false);
              setOfferOpen(true);
            }}
            className="flex-1 whitespace-nowrap rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200 hover:bg-amber-400/20 sm:flex-none"
          >
            Make Offer
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !draft.trim()}
            className={classNames(
              'flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors sm:flex-none',
              sending || !draft.trim()
                ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                : 'bg-primary-400 text-primary-950 hover:bg-primary-300'
            )}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
