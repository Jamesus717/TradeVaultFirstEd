'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { DEMO_WISHLIST, demoEmpty, demoMode } from '../../../lib/demo';
import {
  addMissingToWants,
  pickMissing,
  undoMissingToWants,
  type MissingCard,
  type MissingReceipt,
} from '../../../lib/missingToWants';
import { useWishlistIds } from '../../trade/hooks/useWishlistIds';

type Props = {
  userId: string | null;
  cards: MissingCard[];
  owned: Record<string, boolean>;
};

type Toast = { message: string; receipt: MissingReceipt };

// Add every missing card of the set to the wishlist: confirm first, Undo after.
export function MissingToWants({ userId, cards, owned }: Props) {
  const remoteWanted = useWishlistIds(demoMode ? null : userId);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // A different set means a different list: close the confirm step.
  const firstId = cards[0]?.setId ?? '';
  useEffect(() => {
    const t = setTimeout(() => {
      setConfirming(false);
      setError('');
    }, 0);
    return () => clearTimeout(t);
  }, [firstId]);

  const wanted = useMemo(() => {
    const all = new Set<string>([...remoteWanted, ...added]);
    if (demoMode && !demoEmpty) for (const row of DEMO_WISHLIST) all.add(row.card_id);
    return all;
  }, [remoteWanted, added]);

  const todo = useMemo(() => pickMissing(cards, owned, wanted), [cards, owned, wanted]);
  const canWrite = demoMode || Boolean(supabase && userId);

  function showToast(next: Toast) {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 8000);
  }

  async function confirm() {
    if (busy || todo.length === 0) return;
    setBusy(true);
    setError('');
    const batch = todo;
    if (demoMode || !supabase || !userId) {
      // Demo has no database: remember it in memory only.
      const ids = batch.map((c) => c.baseCardId);
      setAdded((cur) => new Set([...cur, ...ids]));
      setConfirming(false);
      showToast({ message: `Added ${ids.length} to your wishlist (example).`, receipt: { cardIds: ids } });
    } else {
      const result = await addMissingToWants(supabase, userId, batch);
      if (!result.ok) {
        setError(`Couldn't add: ${result.message}`);
      } else {
        const ids = result.receipt.cardIds;
        setAdded((cur) => new Set([...cur, ...batch.map((c) => c.baseCardId)]));
        setConfirming(false);
        showToast({
          message: ids.length ? `Added ${ids.length} to your wishlist.` : 'Those cards were already on your wishlist.',
          receipt: result.receipt,
        });
      }
    }
    setBusy(false);
  }

  async function undo() {
    if (!toast || busy) return;
    if (timer.current) clearTimeout(timer.current);
    const { receipt } = toast;
    setBusy(true);
    if (!demoMode && supabase && userId) {
      const result = await undoMissingToWants(supabase, userId, receipt);
      if (!result.ok) {
        setToast({ ...toast, message: `Couldn't undo: ${result.message}` });
        timer.current = setTimeout(() => setToast(null), 8000);
        setBusy(false);
        return;
      }
    }
    const gone = new Set(receipt.cardIds);
    setAdded((cur) => new Set([...cur].filter((id) => !gone.has(id))));
    setToast(null);
    setBusy(false);
  }

  const showButton = canWrite && todo.length > 0;
  if (!showButton && !toast) return null;

  return (
    <>
      {showButton ? (
        confirming ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3" role="group" aria-label="Confirm add to wishlist">
            <p className="text-sm text-primary-50/90">
              Add {todo.length} {todo.length === 1 ? 'card' : 'cards'} to your wishlist? Cards you own or already want are skipped.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="min-h-11 rounded-lg bg-primary-400 px-4 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:opacity-60"
              >
                {busy ? 'Adding…' : 'Yes, add'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="min-h-11 rounded-lg px-4 text-sm font-semibold text-primary-200 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
            {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-1 flex min-h-11 items-center text-left text-sm font-semibold text-primary-200 underline underline-offset-4 hover:text-white"
          >
            Add {todo.length} missing to wishlist
          </button>
        )
      ) : null}
      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-white/10 bg-stone-900 p-3 text-sm text-white shadow-lg"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-primary-300 hover:bg-white/10"
          >
            Undo
          </button>
        </div>
      ) : null}
    </>
  );
}
