'use client';

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
}) {
  return (
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
              onSend();
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
          onClick={onSend}
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
  );
}
