// Export CSV for the binder and the wishlist: what is on screen, as a file.
// Columns: card, set, number, condition, qty, price. No notes, no user ids.
// Client-side only; uses the shared cell escaping (quotes, commas, newlines,
// and a leading ' on cells starting with = + - @ tab or CR).

import { escapeCsvCell } from './binderCsv';

export const EXPORT_COLUMNS = ['card', 'set', 'number', 'condition', 'qty', 'price'] as const;

export type ExportCsvRow = {
  card: string;
  set: string;
  number?: string | null;
  condition?: string | null;
  qty?: number | null;
  price?: number | null;
};

export function toExportCsv(rows: ExportCsvRow[]): string {
  const lines: string[] = [EXPORT_COLUMNS.join(',')];
  for (const row of rows) {
    const qty = row.qty != null && Number.isFinite(row.qty) && row.qty > 0 ? Math.floor(row.qty) : 1;
    lines.push(
      [
        escapeCsvCell(row.card),
        escapeCsvCell(row.set),
        escapeCsvCell(row.number ?? ''),
        escapeCsvCell(row.condition ?? ''),
        String(qty),
        // Numbers are written as numbers, never run through the formula guard.
        row.price != null && Number.isFinite(row.price) && row.price >= 0 ? row.price.toFixed(2) : '',
      ].join(',')
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

// Says what the file will contain, so the filters are never a surprise.
export function exportScope(what: string, shown: number, total: number, filterCount: number): string {
  if (filterCount === 0) return `Exports ${shown} ${what}.`;
  return `Exports the ${shown} of ${total} ${what} that match your ${filterCount} current filter${filterCount === 1 ? '' : 's'}.`;
}
