import Image from 'next/image';
import type { MatchRow, TraderMatch } from '../../lib/matching';

const SHOWN = 3;

function Pocket({ row }: { row: MatchRow }) {
  return (
    <figure className="min-w-0">
      <div className="tcg-card is-owned">
        {row.image_url ? (
          <Image src={row.image_url} alt={row.card_name ?? 'Card'} fill sizes="120px" className="object-cover" unoptimized />
        ) : null}
      </div>
      <figcaption className="mt-1.5 truncate text-xs text-stone-300">{row.card_name}</figcaption>
      <p className="truncate text-xs text-stone-500">
        {row.condition ?? 'Not graded'}
        {row.is_spare ? ', spare' : ''}
      </p>
    </figure>
  );
}

function Side({ title, rows, empty }: { title: string; rows: MatchRow[]; empty: string }) {
  const hidden = rows.length - SHOWN;

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-sm font-medium text-stone-200">
        {title}
        {hidden > 0 ? <span className="font-normal text-stone-400"> and {hidden} more</span> : null}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {rows.slice(0, SHOWN).map((row) => (
          <Pocket key={row.item_id} row={row} />
        ))}
        {rows.length === 0 ? (
          <div className="pocket col-span-1 flex items-center justify-center p-2 text-center text-xs text-stone-400">
            {empty}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  match: TraderMatch;
  starting: boolean;
  onStart: () => void;
};

export function MatchCard({ match, starting, onStart }: Props) {
  return (
    <article className="panel p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-semibold text-white">{match.name}</h2>
          {match.twoWay ? <span className="holo-tag">Two-way</span> : null}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={starting || match.theyHave.length === 0}
          className="min-h-11 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-400"
        >
          {starting ? 'Starting...' : match.theyHave.length === 0 ? 'Waiting on their side' : 'Start trade'}
        </button>
      </header>

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
        <Side title="You get" rows={match.theyHave} empty="Nothing you want yet" />
        <Side title="You give" rows={match.iHave} empty="Nothing they want yet" />
      </div>
    </article>
  );
}
