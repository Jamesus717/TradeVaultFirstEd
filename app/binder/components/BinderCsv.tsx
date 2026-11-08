'use client';

import { useState } from 'react';
import { CSV_COLUMNS, MAX_CSV_BYTES, MAX_CSV_ROWS, mergeBinderRows, parseImport, saveImport, toCsv } from '../../../lib/binderCsv';
import type { ExportRow, ImportPreview, SetRef } from '../../../lib/binderCsv';
import { DEMO_BINDER_ROWS, DEMO_BINDER_SETS, demoMode } from '../../../lib/demo';
import { fetchSets } from '../../../lib/fetchSets';
import { fetchSetVariants } from '../../../lib/setCardsCache';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';

async function loadSets(): Promise<SetRef[]> {
  if (demoMode) return DEMO_BINDER_SETS;
  try {
    const res = await fetchSets();
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: SetRef[] };
    return (json.data ?? []).map((s) => ({ id: s.id, name: s.name }));
  } catch {
    return [];
  }
}

async function loadExportRows(userId: string): Promise<ExportRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_cards')
    .select('card_id, set_id')
    .eq('user_id', userId)
    .eq('owned', true);
  if (error) throw new Error(error.message);

  const owned = new Map<string, string | null>();
  for (const row of data ?? []) owned.set(row.card_id as string, (row.set_id as string | null) ?? null);

  const names = new Map<string, { name: string; setName: string }>();
  const setIds = [...new Set([...owned.values()].filter((id): id is string => Boolean(id)))];
  await Promise.all(
    setIds.map(async (setId) => {
      try {
        for (const card of await fetchSetVariants(setId)) {
          names.set(card.baseCardId, { name: card.name, setName: card.setName });
        }
      } catch {
        // Names fall back to the card id.
      }
    })
  );

  const prices = new Map<string, number>();
  const ids = [...owned.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const { data: priceRows } = await supabase
      .from('card_prices')
      .select('card_id, price_mid')
      .in('card_id', ids.slice(i, i + 100));
    for (const p of priceRows ?? []) {
      if (p.card_id && p.price_mid) prices.set(p.card_id as string, Number(p.price_mid));
    }
  }

  return ids.map((cardId) => {
    const setId = owned.get(cardId) ?? '';
    const known = names.get(cardId);
    return {
      cardId,
      cardName: known?.name ?? cardId,
      setName: known?.setName ?? setId,
      condition: null,
      qty: 1,
      price: prices.get(cardId) ?? null,
    };
  });
}

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tradevault-binder.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function BinderCsv() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // Demo mode has no database: the example binder lives in memory.
  const [demoRows, setDemoRows] = useState<ExportRow[]>(DEMO_BINDER_ROWS);

  if (!user && !demoMode) return null;

  function say(text: string, bad = false) {
    setMessage(text);
    setFailed(bad);
  }

  async function exportCsv() {
    setBusy(true);
    try {
      const rows = demoMode ? demoRows : await loadExportRows(user!.id);
      if (rows.length === 0) {
        say('Your binder is empty, so there is nothing to export.', true);
        return;
      }
      download(toCsv(rows));
      say(`Exported ${rows.length} card${rows.length === 1 ? '' : 's'}.`);
    } catch (cause) {
      say(cause instanceof Error ? cause.message : 'Export failed.', true);
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(file: File | undefined) {
    setPreview(null);
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      say(`File is too big. The limit is ${MAX_CSV_BYTES / 1024} KB.`, true);
      return;
    }
    setBusy(true);
    const [text, sets] = await Promise.all([file.text(), loadSets()]);
    const result = parseImport(text, sets, file.size);
    setPreview(result);
    setBusy(false);
    say(result.fileError ?? '', Boolean(result.fileError));
  }

  async function confirmImport() {
    if (!preview) return;
    const good = preview.rows.filter((r) => r.value);
    setBusy(true);
    if (demoMode) {
      const added: ExportRow[] = good.map((r) => ({
        cardId: r.value!.cardId,
        cardName: r.card.replace(/\s*\[[^\]]*\]\s*$/, '') || r.value!.cardId,
        setName: r.set,
        condition: r.value!.condition,
        qty: r.value!.qty,
        price: r.value!.price,
      }));
      setDemoRows((current) => mergeBinderRows(current, added));
      say(`Demo: added ${added.length} example card${added.length === 1 ? '' : 's'} (kept in memory only).`);
    } else if (supabase && user) {
      const result = await saveImport(supabase, user.id, good);
      say(result.message, !result.ok);
    }
    setPreview(null);
    setBusy(false);
  }

  return (
    <div className="panel p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-11 text-left text-sm font-semibold text-primary-200"
      >
        Import or export CSV {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-3 space-y-4 text-sm text-stone-300">
          {demoMode && <p className="text-amber-300">Demo: example binder, nothing is saved to a database.</p>}
          <p>
            Columns: {CSV_COLUMNS.join(', ')}. Card looks like &quot;Charizard [base1-4]&quot;. Up to {MAX_CSV_ROWS} rows
            and {MAX_CSV_BYTES / 1024} KB. Saving marks each card as owned.{' '}
            {demoMode
              ? 'In this demo, condition, qty and price are kept and shown below.'
              : 'Condition, qty and price are checked but not stored yet.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportCsv}
              disabled={busy}
              className="min-h-11 rounded-xl bg-primary-400 px-4 py-2 font-medium text-primary-950 hover:bg-primary-300 disabled:opacity-50"
            >
              Export CSV
            </button>
            <label className="flex min-h-11 cursor-pointer items-center rounded-xl border border-white/10 px-4 py-2 font-medium hover:bg-white/[0.06]">
              Choose CSV to import
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  void pickFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>

          {demoMode && (
            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs" aria-label="Demo binder">
                <thead className="bg-stone-900">
                  <tr>
                    <th className="p-2">Card</th>
                    <th className="p-2">Set</th>
                    <th className="p-2">Condition</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {demoRows.map((r) => (
                    <tr key={r.cardId} className="border-t border-white/5">
                      <td className="p-2">{r.cardName}</td>
                      <td className="p-2">{r.setName}</td>
                      <td className="p-2">{r.condition ?? '-'}</td>
                      <td className="p-2">{r.qty ?? 1}</td>
                      <td className="p-2">{r.price == null ? '-' : `£${r.price.toFixed(2)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {message && (
            <p role="status" className={failed ? 'text-rose-300' : 'text-primary-200'}>
              {message}
            </p>
          )}

          {preview && !preview.fileError && (
            <div className="space-y-3">
              <p>
                {preview.validCount} ready, {preview.errorCount} with errors. Rows with errors are skipped.
              </p>
              <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-900">
                    <tr>
                      <th className="p-2">Line</th>
                      {CSV_COLUMNS.map((c) => (
                        <th key={c} className="p-2 capitalize">
                          {c}
                        </th>
                      ))}
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.line} className="border-t border-white/5 align-top">
                        <td className="p-2">{row.line}</td>
                        <td className="p-2">{row.card}</td>
                        <td className="p-2">{row.set}</td>
                        <td className="p-2">{row.condition}</td>
                        <td className="p-2">{row.qty}</td>
                        <td className="p-2">{row.price}</td>
                        <td className={`p-2 ${row.errors.length ? 'text-rose-300' : 'text-primary-200'}`}>
                          {row.errors.length ? row.errors.join(' ') : 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={busy || preview.validCount === 0}
                  className="min-h-11 rounded-xl bg-primary-400 px-4 py-2 font-medium text-primary-950 hover:bg-primary-300 disabled:opacity-50"
                >
                  Add {preview.validCount} card{preview.validCount === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="min-h-11 rounded-xl border border-white/10 px-4 py-2 hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
