'use client';

import Image from 'next/image';
import type { ListingFormState } from '../hooks/useListingForm';
import type { ListingCondition } from '../types';
import { canReverseHolo, classNames } from '../utils';
import { CardSearchStep } from './CardSearchStep';

type Props = {
  form: ListingFormState;
};

export function ListingModal({ form }: Props) {
  if (!form.modalOpen) {
    return null;
  }

  const { selectedCard, listingType, variant } = form;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-stone-900 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">List a Card</h2>
            <p className="mt-1 text-sm text-stone-400">Create a trade or sale listing.</p>
          </div>
          <button
            type="button"
            onClick={form.closeModal}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <CardSearchStep
            selectedCard={selectedCard}
            onSelectCard={form.selectCard}
            onClearSelectedCard={form.clearSelectedCard}
            cardSearchMode={form.cardSearchMode}
            onChangeCardSearchMode={form.setCardSearchMode}
            query={form.modalStepCardQuery}
            onChangeQuery={form.setModalStepCardQuery}
            results={form.modalCardResults}
            loading={form.modalCardLoading}
            error={form.modalCardError}
            ownedCards={form.ownedCards}
          />

          <div className={classNames(!selectedCard ? 'opacity-60' : '')}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
              Step 2 — Listing details
            </p>

            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-200">Variant</p>
                <div className="flex items-center gap-2">
                  {form.availableVariants.map((value) => {
                    const reverseDisabled =
                      value === 'Reverse Holo' && !canReverseHolo(selectedCard?.rarity);

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!selectedCard || reverseDisabled}
                        onClick={() => form.setVariant(value)}
                        className={classNames(
                          'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                          variant === value
                            ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                            : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]',
                          !selectedCard || reverseDisabled ? 'cursor-not-allowed opacity-50' : ''
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-200">Condition</p>
                <select
                  value={form.condition}
                  onChange={(event) => form.setCondition(event.target.value as ListingCondition)}
                  disabled={!selectedCard}
                  className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                >
                  {(['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played'] as const).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-200">Listing type</p>
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    { value: 'trade', label: 'Trade Only' },
                    { value: 'sale', label: 'Sale Only' },
                    { value: 'either', label: 'Trade or Sale' },
                  ] as const).map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      disabled={!selectedCard}
                      onClick={() => form.setListingType(entry.value)}
                      className={classNames(
                        'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
                        listingType === entry.value
                          ? 'border-primary-300/20 bg-primary-400/10 text-primary-200'
                          : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]',
                        !selectedCard ? 'cursor-not-allowed opacity-50' : ''
                      )}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              {listingType === 'sale' || listingType === 'either' ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-200">Price</p>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-stone-300">
                      £
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.price}
                      onChange={(event) => form.setPrice(event.target.value)}
                      placeholder="Price"
                      disabled={!selectedCard}
                      className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {listingType === 'trade' || listingType === 'either' ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-200">Trade description</p>
                  <textarea
                    rows={2}
                    value={form.tradeDescription}
                    onChange={(event) => form.setTradeDescription(event.target.value)}
                    placeholder="What would you trade for? e.g. Looking for Charizard ex full art"
                    disabled={!selectedCard}
                    className="w-full resize-none rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-200">Postcode prefix</p>
                <input
                  value={form.postcodePrefix}
                  onChange={(event) => form.setPostcodePrefix(event.target.value)}
                  placeholder="e.g. SW1, M1, EH1"
                  disabled={!selectedCard}
                  className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                />
                <p className="text-xs text-stone-500">
                  Only the first part — we never store your full postcode
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-200">Photo upload (optional)</p>
                <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/10 p-6 text-center transition-colors hover:border-primary-400/40">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      form.selectUploadFile(event.target.files?.[0] ?? null);
                    }}
                    disabled={!selectedCard}
                  />
                  {form.uploadPreview ? (
                    <div className="mx-auto w-40 overflow-hidden rounded-2xl border border-white/10 bg-stone-950/50">
                      <Image
                        src={form.uploadPreview}
                        alt="Upload preview"
                        width={320}
                        height={240}
                        className="h-auto w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-stone-400">
                      Drag and drop or click to upload
                      <div className="mt-1 text-xs text-stone-500">Image only · max 5MB</div>
                    </div>
                  )}
                </label>
              </div>

              {form.submitError ? (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                  {form.submitError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={form.handleSubmitListing}
                disabled={!form.modalCanSubmit || form.submitting}
                className={classNames(
                  'w-full rounded-2xl py-3 text-sm font-semibold transition-colors',
                  form.modalCanSubmit
                    ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                    : 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400',
                  form.submitting ? 'opacity-70' : ''
                )}
              >
                {form.submitting ? 'Submitting…' : 'Create listing'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
