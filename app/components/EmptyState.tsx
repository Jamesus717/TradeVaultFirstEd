import Link from 'next/link';
import type { ReactNode } from 'react';

type Action =
  | { label: string; href: string; onClick?: never; disabled?: never }
  | { label: string; onClick: () => void; href?: never; disabled?: boolean };

type Props = {
  title: string;
  body?: ReactNode;
  action?: Action;
  /** Smaller padding for empty states that sit inside another panel. */
  compact?: boolean;
};

const actionClass =
  'mt-2 inline-flex rounded-xl bg-primary-400 px-5 py-2.5 text-sm font-semibold text-primary-950 transition-colors hover:bg-primary-300 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-400';

/*
 * One empty state for every page: a fanned stack of three blank card backs,
 * a heading, one line of help and at most one action.
 */
export function EmptyState({ title, body, action, compact = false }: Props) {
  return (
    <div
      className={`panel mx-auto flex w-full max-w-2xl flex-col items-center gap-3 text-center ${
        compact ? 'p-8' : 'p-10 sm:p-14'
      }`}
    >
      <div aria-hidden className="relative mb-3 h-20 w-24">
        <span className="absolute left-1 top-2 h-16 w-12 -rotate-12 rounded-md border border-white/10 bg-stone-800" />
        <span className="absolute right-1 top-2 h-16 w-12 rotate-12 rounded-md border border-white/10 bg-stone-800" />
        <span className="absolute left-1/2 top-0 flex h-16 w-12 -translate-x-1/2 items-center justify-center rounded-md border border-primary-300/30 bg-gradient-to-br from-primary-500/30 to-stone-900">
          <span className="h-4 w-4 rounded-full border-2 border-primary-200/70" />
        </span>
      </div>
      <h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2>
      {body ? <p className="max-w-md text-sm leading-6 text-stone-400">{body}</p> : null}
      {action ? (
        action.href ? (
          <Link href={action.href} className={actionClass}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} disabled={action.disabled} className={actionClass}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
