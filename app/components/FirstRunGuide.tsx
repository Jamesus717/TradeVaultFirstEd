'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { demoEmpty, demoMode } from '../../lib/demo';
import {
  DEMO_PROGRESS_KEY,
  DISMISS_KEY,
  guideSteps,
  NO_PROGRESS,
  parseDemoProgress,
  parseDismissed,
  shouldShowGuide,
  type Progress,
  type StepKey,
} from '../../lib/firstRun';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows can block storage. The guide just comes back next time.
  }
}

/*
 * Three steps for a brand new account. Real accounts tick the steps off from
 * their own data. The demo has no database, so a step ticks when you open it.
 * Dismissing is remembered in this browser only.
 */
export function FirstRunGuide({ matchCount }: { matchCount: number }) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);
  const [counts, setCounts] = useState<{ card: boolean; want: boolean } | null>(null);
  const [demoProgress, setDemoProgress] = useState<Progress>(NO_PROGRESS);
  const userId = user?.id ?? null;

  useEffect(() => {
    // localStorage only exists in the browser, so it is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(parseDismissed(read(DISMISS_KEY)));
    setDemoProgress(parseDemoProgress(read(DEMO_PROGRESS_KEY)));
  }, []);

  useEffect(() => {
    if (demoMode || !userId || !supabase) return;
    const client = supabase;
    let active = true;
    (async () => {
      const [cards, wants] = await Promise.all([
        client.from('user_cards').select('card_id', { count: 'exact', head: true }).eq('user_id', userId).eq('owned', true),
        client.from('wishlist_cards').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      if (!active) return;
      // A failed count must not nag someone who already has cards.
      if (cards.error || wants.error) return;
      setCounts({ card: (cards.count ?? 0) > 0, want: (wants.count ?? 0) > 0 });
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    write(DISMISS_KEY, '1');
  }, []);

  const opened = useCallback(
    (key: StepKey) => {
      if (!demoMode) return;
      const next = { ...demoProgress, [key]: true };
      setDemoProgress(next);
      write(DEMO_PROGRESS_KEY, JSON.stringify(next));
    },
    [demoProgress]
  );

  const progress: Progress | null = demoMode
    ? demoEmpty
      ? demoProgress
      : { card: true, want: true, matches: true }
    : counts
      ? { ...counts, matches: matchCount > 0 }
      : null;

  if (!progress || !shouldShowGuide({ dismissed, progress, canAct: demoMode || Boolean(userId) })) {
    return null;
  }

  const steps = guideSteps(progress);

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="first-run-title" data-testid="first-run-guide">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="first-run-title" className="text-xl font-semibold text-white">
            Get started in 3 steps
          </h2>
          <p className="text-sm leading-6 text-stone-300">Add a card and a want, and TradeVault finds people to swap with.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-stone-300 hover:text-white"
        >
          Dismiss
        </button>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`flex flex-col gap-2 rounded-xl border p-4 ${
              step.current ? 'border-primary-300/40 bg-primary-400/10' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  step.done ? 'bg-primary-400 text-primary-950' : 'border border-white/20 text-stone-300'
                }`}
              >
                {step.done ? '✓' : index + 1}
              </span>
              <span>
                {step.title}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </span>
            </span>
            <span className="text-sm leading-6 text-stone-300">{step.body}</span>
            {!step.done ? (
              <Link
                href={step.href}
                onClick={() => opened(step.key)}
                className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
                  step.current
                    ? 'bg-primary-400 text-primary-950 hover:bg-primary-300'
                    : 'border border-white/15 text-stone-100 hover:border-white/30'
                }`}
              >
                {step.action}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
