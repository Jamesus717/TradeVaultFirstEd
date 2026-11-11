'use client';

import { getBinderRows, useBinderDetails } from '../../../lib/binderDetails';
import { exportScope } from '../../../lib/exportCsv';
import { ExportCsvButton } from '../../components/ExportCsvButton';
import type { CardVariant } from '../types';

type Props = {
  cards: CardVariant[];
  owned: Record<string, boolean>;
  totalInSet: number;
  filterCount: number;
  setName: string;
};

// Exports the owned cards of the open set that pass the current search,
// ownership and condition/price filters. Condition, qty and price come from the
// demo binder only until the binder-fields migration is applied; otherwise blank.
export function BinderExport({ cards, owned, totalInSet, filterCount, setName }: Props) {
  const details = useBinderDetails();
  const demoRows = new Map(getBinderRows().map((r) => [r.cardId.toLowerCase(), r]));
  const ownedCards = cards.filter((c) => owned[c.id]);
  const rows = ownedCards.map((c) => {
    const d = details[c.baseCardId.toLowerCase()];
    return {
      card: c.name,
      set: c.setName,
      number: c.number,
      condition: d?.condition ?? null,
      qty: demoRows.get(c.baseCardId.toLowerCase())?.qty ?? 1,
      price: d?.price ?? null,
    };
  });
  return (
    <div className="panel p-5">
      <ExportCsvButton
        filename="tradevault-binder-filtered.csv"
        emptyMessage="No owned cards to export here. Mark some as owned or loosen your filters."
        scope={`${exportScope(`owned cards in ${setName || 'this set'}`, rows.length, totalInSet, filterCount)} Notes are not included.`}
        rows={rows}
      />
    </div>
  );
}
