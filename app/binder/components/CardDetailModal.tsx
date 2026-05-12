import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { CardVariant } from '../types';
import { usePriceData } from '../hooks/usePriceData';

type Props = {
  card: CardVariant | null;
  isOpen: boolean;
  onClose: () => void;
  isOwned: boolean;
  onToggleOwned: () => void;
  isSaving: boolean;
};

export function CardDetailModal({ card, isOpen, onClose, isOwned, onToggleOwned, isSaving }: Props) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const price = usePriceData(
    card?.baseCardId ?? '',
    card?.name ?? '',
    card?.setName ?? '',
    card?.variant ?? '',
    isOpen && card !== null
  );

  if (!isOpen || !card) return null;

  const variantColors: Record<string, string> = {
    'Normal': 'bg-stone-500/10 border-stone-500/20 text-stone-300',
    'Reverse Holo': 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    '1st Edition': 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    'Shadowless': 'bg-sky-500/10 border-sky-500/20 text-sky-300',
    'Unlimited': 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  };

  const badgeColor = variantColors[card.variant] || variantColors['Normal'];

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity"
      onClick={handleBackdropClick}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-stone-950 shadow-2xl animate-in fade-in zoom-in-95 md:flex-row">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/80 text-stone-400 hover:bg-stone-800 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* LEFT COLUMN: Image & Badge */}
        <div className="flex w-full flex-col items-center bg-white/[0.02] p-6 md:w-1/2 md:p-8 lg:p-10">
          <div className="relative aspect-[5/7] w-full max-w-[320px] overflow-hidden rounded-[1rem] ring-1 ring-white/5">
            {card.image ? (
              <Image
                src={card.image}
                alt={`${card.name} ${card.variant}`}
                fill
                sizes="(max-width: 768px) 100vw, 320px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-stone-900 text-stone-500">
                <span className="text-center text-sm px-4">{card.name}<br/>No image available</span>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex w-full max-w-[320px] flex-col items-center gap-3">
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-stone-400">
                #{card.number}
              </p>
              <p className="mt-1 text-sm text-stone-500">{card.setName}</p>
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeColor}`}>
              {card.variant}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Details & Actions */}
        <div className="flex w-full flex-col overflow-y-auto p-6 md:w-1/2 md:p-8 lg:p-10">
          <h2 className="text-3xl font-semibold text-white pr-8">{card.name}</h2>

          <div className="mt-6">
            <button
              type="button"
              onClick={onToggleOwned}
              disabled={isSaving}
              className={`flex w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 font-medium transition-colors ${
                isOwned
                  ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                  : 'border border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10'
              } ${isSaving ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              {isSaving && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {!isSaving && isOwned && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isOwned ? 'In Collection' : 'Add to Collection'}
            </button>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-widest text-stone-400">Market Price</h3>
              <span className="text-xs text-stone-500">eBay UK</span>
            </div>

            <div className="mt-4">
              {price.error ? (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Price data unavailable
                </div>
              ) : price.loading ? (
                <div className="flex items-end justify-between animate-pulse">
                  <div className="h-6 w-16 rounded bg-white/5" />
                  <div className="h-10 w-24 rounded bg-white/10" />
                  <div className="h-6 w-16 rounded bg-white/5" />
                </div>
              ) : (
                <div className="flex items-end justify-between">
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-stone-500 mb-1">LOW</span>
                    <span className="text-lg text-stone-400">
                      {price.lowConfidence ? '~' : ''}£{price.priceLow?.toFixed(2) ?? '--'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-stone-400 mb-1">MID</span>
                    <span className="text-3xl font-semibold text-white">
                      {price.lowConfidence ? '~' : ''}£{price.priceMid?.toFixed(2) ?? '--'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-stone-500 mb-1">HIGH</span>
                    <span className="text-lg text-stone-400">
                      {price.lowConfidence ? '~' : ''}£{price.priceHigh?.toFixed(2) ?? '--'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!price.error && !price.loading && (
              <div className="mt-4 space-y-1">
                {price.lowConfidence && (
                  <p className="text-xs text-amber-500/80">Based on limited sales data</p>
                )}
                <p className="text-xs text-stone-500">
                  Based on {price.sampleSize ?? 0} recent eBay UK sold listings
                </p>
                <p className="text-[11px] text-stone-600">
                  Last updated: just now
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/trade')}
              className="flex-1 rounded-[1rem] border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-stone-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              List for Trade
            </button>
            <button
              type="button"
              onClick={() => router.push('/trade')}
              className="flex-1 rounded-[1rem] border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-stone-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              List for Sale
            </button>
          </div>

          <div className="mt-auto pt-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-4">Card Details</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div className="text-stone-500">Set</div>
              <div className="text-stone-300">{card.setName}</div>
              <div className="text-stone-500">Number</div>
              <div className="text-stone-300">{card.number}</div>
              <div className="text-stone-500">Variant</div>
              <div className="text-stone-300">{card.variant}</div>
              <div className="text-stone-500">In Collection</div>
              <div className="text-stone-300">{isOwned ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
