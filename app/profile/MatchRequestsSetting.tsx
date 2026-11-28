'use client';

import { useEffect, useState } from 'react';
import { demoMode } from '../../lib/demo';
import { supabase } from '../../lib/supabaseClient';

type Status = 'loading' | 'ready' | 'unavailable';

// The owner opt-out from 022: when off, nobody can start a match chat on your
// cards and your matches show "Not taking match requests". On by default.
export function MatchRequestsSetting({ userId }: { userId: string | null }) {
  const [allowed, setAllowed] = useState(true);
  const [status, setStatus] = useState<Status>(demoMode ? 'ready' : 'loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (demoMode || !userId || !supabase) {
      return;
    }
    let active = true;
    supabase
      .from('public_profiles')
      .select('allow_match_requests')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          // The column arrives with 022; until then there is nothing to set.
          setStatus('unavailable');
          return;
        }
        setAllowed(data?.allow_match_requests ?? true);
        setStatus('ready');
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function toggle() {
    const next = !allowed;
    setError('');
    setAllowed(next);
    if (demoMode || !userId || !supabase) {
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase
      .from('public_profiles')
      .update({ allow_match_requests: next })
      .eq('user_id', userId);
    setSaving(false);
    if (saveError) {
      setAllowed(!next);
      setError("That didn't save. Try again.");
    }
  }

  return (
    <section id="settings" className="scroll-mt-20 rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold text-stone-400">Trading</p>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p id="match-requests-label" className="text-sm font-medium text-white">
            Allow match requests
          </p>
          <p id="match-requests-help" className="text-sm text-stone-400">
            {allowed
              ? 'Traders who match your cards can start a chat with you. Each person can open one chat per card.'
              : 'Nobody can start a new match chat on your cards. Existing chats and trade board messages still work.'}
          </p>
          {status === 'unavailable' ? (
            <p className="text-xs text-amber-200/80">Available once matching is switched on.</p>
          ) : null}
          {error ? <p className="text-xs text-rose-200">{error}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-labelledby="match-requests-label"
          aria-describedby="match-requests-help"
          onClick={toggle}
          disabled={saving || status !== 'ready'}
          className={`relative inline-flex h-11 w-[4.25rem] shrink-0 items-center rounded-full p-1 transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 ${
            allowed ? 'bg-primary-400' : 'bg-stone-700'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-9 w-9 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${
              allowed ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </section>
  );
}
