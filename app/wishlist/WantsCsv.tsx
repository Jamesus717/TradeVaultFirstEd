'use client';

import { useState } from 'react';
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  WANTS_COLUMNS,
  parseWantsImport,
  saveWantsImport,
  toWantsCsv,
} from '../../lib/wantsCsv';
import type { WantImportPreview, WantPriority, WantValue } from '../../lib/wantsCsv';
import type { SetRef } from '../../lib/binderCsv';
import { DEMO_BINDER_SETS, demoMode } from '../../lib/demo';
import { fetchSets } from '../../lib/fetchSets';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

export type WantsCsvRow = {
  card_id: string;
  card_name: string;
  set_name: string | null;
  set_id: string | null;
  quantity: number;
  priority: WantPriority;
  note: string | null;
};

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

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tradevault-wants.csv';
  link.click();
  URL.revokeObjectURL(url);
}

type Props = {
  rows: WantsCsvRow[];
  // Called after a confirmed import: demo gets the values to hold in memory,
  // real mode gets an empty list and should reload from the database.
  onImported: (added: WantValue[]) => void;
};

export function WantsCsv({ rows, onImported }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<WantImportPreview | null>(null);

  function say(text: string, bad = false) {
    setMessage(text);
    setFailed(bad);
  }

  function exportCsv() {
    if (rows.length === 0) {
      say('Your wishlist is empty, so there is nothing to export.', true);
      return;
    }
    download(
      toWantsCsv(
        rows.map((r) => ({
          cardId: r.card_id,
          cardName: r.card_name,
          setName: r.set_name ?? r.set_id ?? '',
          priority: r.priority,
          qty: r.quantity,
          note: r.note,
        }))
      )
    );
    say(`Exported ${rows.length} card${rows.length === 1 ? '' : 's'}.`);
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
    const result = parseWantsImport(text, sets, file.size);
    setPreview(result);
    setBusy(false);
    say(result.fileError ?? '', Boolean(result.fileError));
  }

  async function confirmImport() {
    if (!preview) return;
    const good = preview.rows.filter((r) => r.value);
    setBusy(true);
    if (demoMode) {
      const added = good.map((r) => r.value!);
      onImported(added);
      say(`Demo: added ${added.length} example card${added.length === 1 ? '' : 's'} (kept in memory only).`);
    } else if (supabase && user) {
      const result = await saveWantsImport(supabase, user.id, good);
      say(result.message, !result.ok);
      if (result.saved > 0) onImported([]);
    }
    setPreview(null);
    setBusy(false);
  }

  return (
    <section className="panel mt-6 p-5">
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
          <p>
            Columns: {WANTS_COLUMNS.join(', ')}. Only card and set are required. Card looks like &quot;Charizard
            [base1-4]&quot;. Priority is high, medium or low (blank is medium). Up to {MAX_CSV_ROWS} rows and{' '}
            {MAX_CSV_BYTES / 1024} KB. A card already on your list is updated.
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
                      {WANTS_COLUMNS.map((c) => (
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
                        <td className="p-2">{row.priority}</td>
                        <td className="p-2">{row.qty}</td>
                        <td className="p-2">{row.note}</td>
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
    </section>
  );
}
