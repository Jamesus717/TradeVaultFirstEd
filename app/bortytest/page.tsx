'use client';

import { useMemo, useState } from 'react';

type PriceResponse = {
  cardId?: string;
  cardName?: string;
  priceLow?: number | null;
  priceMid?: number | null;
  priceHigh?: number | null;
  currency?: string;
  sampleSize?: number | null;
  source?: string;
  fetchedAt?: string | null;
  lowConfidence?: boolean;
  error?: string;
};

export default function BortyTestPage() {
  const defaultParams = useMemo(
    () => ({
      cardId: 'sv3-223',
      cardName: 'Charizard ex',
      setName: 'Obsidian Flames',
      variant: 'Normal',
    }),
    []
  );

  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [data, setData] = useState<PriceResponse | null>(null);
  const [rawText, setRawText] = useState<string>('');

  async function fetchPrice() {
    setStatus('loading');
    setHttpStatus(null);
    setData(null);
    setRawText('');

    const params = new URLSearchParams(defaultParams);
    const url = `/api/pokemon/price?${params.toString()}`;

    try {
      const res = await fetch(url, { cache: 'no-store' });
      setHttpStatus(res.status);
      const text = await res.text();
      setRawText(text);

      try {
        setData(JSON.parse(text));
      } catch {
        setData({ error: 'Response was not valid JSON' });
      }
    } finally {
      setStatus('done');
    }
  }

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-300/80">
                Test Page
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                eBay Price Endpoint
              </h1>
              <p className="text-sm text-stone-300">
                Calls <span className="font-mono text-stone-200">/api/pokemon/price</span> with a single known card.
              </p>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Request</p>
              <div className="mt-3 grid gap-2 text-sm text-stone-200">
                <div>
                  <span className="text-stone-500">cardId:</span> <span className="font-mono">{defaultParams.cardId}</span>
                </div>
                <div>
                  <span className="text-stone-500">cardName:</span> <span className="font-mono">{defaultParams.cardName}</span>
                </div>
                <div>
                  <span className="text-stone-500">setName:</span> <span className="font-mono">{defaultParams.setName}</span>
                </div>
                <div>
                  <span className="text-stone-500">variant:</span> <span className="font-mono">{defaultParams.variant}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchPrice}
                disabled={status === 'loading'}
                className={`mt-5 w-full rounded-[1rem] px-4 py-3 text-sm font-semibold transition-colors ${
                  status === 'loading'
                    ? 'cursor-not-allowed bg-stone-800 text-stone-400'
                    : 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                }`}
              >
                {status === 'loading' ? 'Fetching…' : 'Find card price'}
              </button>

              <div className="mt-4 text-xs text-stone-500">
                HTTP status: {httpStatus ?? '—'}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Parsed JSON</p>
                <pre className="mt-3 max-h-[260px] overflow-auto rounded-xl bg-stone-950/60 p-3 text-xs text-stone-200 ring-1 ring-white/5">
                  {data ? JSON.stringify(data, null, 2) : '—'}
                </pre>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Raw Response</p>
                <pre className="mt-3 max-h-[260px] overflow-auto rounded-xl bg-stone-950/60 p-3 text-xs text-stone-200 ring-1 ring-white/5">
                  {rawText || '—'}
                </pre>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

