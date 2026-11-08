import { compareTrade, LABEL_TEXT, type FairnessLabel, type TradeItem } from '../../lib/fairTrade';

const LABEL_STYLE: Record<FairnessLabel, { badge: string; bar: string }> = {
  fair: { badge: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200', bar: 'bg-emerald-400' },
  slightly_uneven: { badge: 'border-amber-300/30 bg-amber-400/10 text-amber-200', bar: 'bg-amber-400' },
  uneven: { badge: 'border-rose-300/30 bg-rose-400/10 text-rose-200', bar: 'bg-rose-400' },
  unknown: { badge: 'border-white/10 bg-white/[0.04] text-stone-300', bar: 'bg-stone-500' },
};

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function Row({ label, total, max, bar }: { label: string; total: number; max: number; bar: string }) {
  const width = max > 0 ? Math.max(2, Math.round((total / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-stone-400">{label}</span>
        <span className="font-semibold tabular-nums text-stone-100">{gbp.format(total)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

type Props = {
  get: TradeItem[];
  give: TradeItem[];
  getLabel?: string;
  giveLabel?: string;
  loading?: boolean;
  // Shown instead of the gap line when one side is empty, e.g. "No offer yet".
  emptyHint?: string;
};

export function FairTradeMeter({ get, give, getLabel = 'You get', giveLabel = 'You give', loading, emptyHint }: Props) {
  const result = compareTrade({ get, give });
  const style = LABEL_STYLE[result.label];
  const max = Math.max(result.getTotal, result.giveTotal);
  const unpriced = result.unpriced.get + result.unpriced.give;

  let summary: string;
  if (loading) summary = 'Checking prices...';
  else if (result.label === 'unknown') summary = emptyHint ?? 'Not enough prices to compare yet.';
  else if (result.favours === 'even') summary = 'Both sides are worth the same.';
  else
    summary = `${gbp.format(result.gapAbs)} gap (${result.gapPct}%), ${
      result.favours === 'you' ? 'in your favour' : 'in their favour'
    }.`;

  return (
    <section
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
      aria-label={`Fair-trade meter: ${loading ? 'loading' : LABEL_TEXT[result.label]}`}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone-300">Fair-trade meter</p>
        {loading ? null : (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
            {LABEL_TEXT[result.label]}
          </span>
        )}
      </header>

      <div className="space-y-2">
        <Row label={getLabel} total={result.getTotal} max={max} bar={style.bar} />
        <Row label={giveLabel} total={result.giveTotal} max={max} bar={style.bar} />
      </div>

      <p className="mt-2 text-xs text-stone-300">{summary}</p>
      {!loading && unpriced > 0 ? (
        <p className="mt-1 text-[11px] text-stone-500">
          {unpriced} card{unpriced === 1 ? '' : 's'} with no price yet, counted as £0.
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-stone-500">Market prices in GBP. A guide, not a valuation.</p>
    </section>
  );
}
