'use client';

import { useState } from 'react';
import { toExportCsv } from '../../lib/exportCsv';
import type { ExportCsvRow } from '../../lib/exportCsv';

type Props = {
  filename: string;
  rows: ExportCsvRow[];
  // Plain sentence saying what the file holds (filters included).
  scope: string;
  emptyMessage: string;
};

export function ExportCsvButton({ filename, rows, scope, emptyMessage }: Props) {
  const [message, setMessage] = useState('');

  function run() {
    if (rows.length === 0) {
      setMessage(emptyMessage);
      return;
    }
    const url = URL.createObjectURL(new Blob([toExportCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${rows.length} card${rows.length === 1 ? '' : 's'}.`);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={run}
        className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-primary-200 hover:bg-white/[0.06]"
      >
        Export CSV
      </button>
      <p className="text-xs text-stone-400" role="status">
        {message || scope}
      </p>
    </div>
  );
}
