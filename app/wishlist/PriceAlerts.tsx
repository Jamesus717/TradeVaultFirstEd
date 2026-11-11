import Image from 'next/image';
import Link from 'next/link';
import { formatGbp, type PriceAlert } from '../../lib/priceAlerts';

type Props = {
  alerts: PriceAlert[];
  example?: boolean;
  // Home page: a few rows and a link to the full list.
  limit?: number;
};

export function PriceAlerts({ alerts, example = false, limit }: Props) {
  if (alerts.length === 0) return null;
  const shown = limit ? alerts.slice(0, limit) : alerts;

  return (
    <section aria-labelledby="under-target" className="panel space-y-3 border-emerald-400/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="under-target" className="text-lg font-semibold text-white">
            Now under your target
          </h2>
          <p className="text-xs text-stone-400">
            {alerts.length} {alerts.length === 1 ? 'card is' : 'cards are'} at or below the price you set
            {example ? ' (example prices)' : ''}.
          </p>
        </div>
        {limit && alerts.length > limit ? (
          <Link href="/wishlist" className="min-h-11 content-center text-sm font-medium text-primary-300 hover:text-primary-200">
            See all {alerts.length}
          </Link>
        ) : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((alert) => (
          <li key={alert.wishlistId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="w-12 shrink-0">
              {alert.imageUrl ? (
                <Image src={alert.imageUrl} alt="" width={96} height={134} className="h-auto w-full rounded-md" />
              ) : (
                <div className="aspect-[5/7] rounded-md bg-stone-950/70" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{alert.cardName}</p>
              <p className="truncate text-xs text-stone-400">
                {alert.setName ?? 'Unknown set'}
                {alert.cardNumber ? ` · #${alert.cardNumber}` : ''}
              </p>
              <p className="mt-1 text-xs text-stone-300">
                <span className="font-semibold text-emerald-300">{formatGbp(alert.price)}</span>
                <span className="text-stone-500"> · target {formatGbp(alert.target)}</span>
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-200">
              {alert.percentUnder > 0 ? `${alert.percentUnder}% under` : 'At target'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-2xs text-stone-500">Market price from the price cache, checked in the last 7 days.</p>
    </section>
  );
}
