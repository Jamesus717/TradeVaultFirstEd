'use client';

import { useRef, useState } from 'react';
import { formatListText } from '../../lib/listText';
import type { TextItem } from '../../lib/listText';

type Props = {
  title: string;
  getItems: () => Promise<TextItem[]> | TextItem[];
  emptyMessage: string;
};

// Copies a short plain-text list. If the clipboard is blocked, the text shows
// in a textarea (already selected) so it can be copied by hand.
export function CopyAsText({ title, getItems, emptyMessage }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    setBusy(true);
    setFallback(null);
    try {
      const items = await getItems();
      if (items.length === 0) {
        setMessage(emptyMessage);
        setFailed(true);
        return;
      }
      const text = formatListText(title, items);
      try {
        if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
        await navigator.clipboard.writeText(text);
        setMessage(`Copied ${items.length} card${items.length === 1 ? '' : 's'} as text.`);
        setFailed(false);
      } catch {
        setFallback(text);
        setMessage('Your browser blocked copying. Select the text below and copy it.');
        setFailed(true);
        requestAnimationFrame(() => areaRef.current?.select());
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not build the list.');
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <button
        type="button"
        onClick={copy}
        disabled={busy}
        className="min-h-11 rounded-xl border border-white/10 px-4 py-2 font-medium text-stone-200 hover:bg-white/[0.06] disabled:opacity-50"
      >
        Copy as text
      </button>
      {message && (
        <p role="status" className={failed ? 'text-rose-300' : 'text-primary-200'}>
          {message}
        </p>
      )}
      {fallback !== null && (
        <textarea
          ref={areaRef}
          readOnly
          value={fallback}
          rows={8}
          aria-label={`${title} as plain text`}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-xl border border-white/10 bg-stone-900 p-3 text-xs text-stone-100"
        />
      )}
    </div>
  );
}
