'use client';

// Demo-only store for condition and price. The binder CSV tool writes to it and
// the binder filters read it. Real mode has no such columns until proposal 024
// is applied, so this stays empty there and the filters hide.
import { useSyncExternalStore } from 'react';
import { DEMO_BINDER_ROWS, demoEmpty, demoMode } from './demo';
import type { ExportRow } from './binderCsv';
import { mergeBinderRows } from './binderCsv';
import type { DetailsById } from './binderFilters';

// A brand new demo account (DEMO_EMPTY=1) has an empty binder.
let rows: ExportRow[] = demoMode && !demoEmpty ? [...DEMO_BINDER_ROWS] : [];
const listeners = new Set<() => void>();

export function getBinderRows(): ExportRow[] {
  return rows;
}

export function addBinderRows(added: ExportRow[]) {
  // Keep the original date when a card is re-imported; new cards get today.
  const now = new Date().toISOString();
  const before = new Map(rows.map((r) => [r.cardId.toLowerCase(), r.addedAt]));
  rows = mergeBinderRows(
    rows,
    added.map((r) => ({ ...r, addedAt: r.addedAt ?? before.get(r.cardId.toLowerCase()) ?? now }))
  );
  detailsCache = null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let detailsCache: DetailsById | null = null;
const EMPTY: DetailsById = {};

function snapshot(): DetailsById {
  if (!demoMode) return EMPTY;
  if (!detailsCache) {
    detailsCache = {};
    for (const r of rows) {
      detailsCache[r.cardId.toLowerCase()] = { condition: r.condition ?? null, price: r.price ?? null, addedAt: r.addedAt ?? null };
    }
  }
  return detailsCache;
}

export function useBinderDetails(): DetailsById {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
