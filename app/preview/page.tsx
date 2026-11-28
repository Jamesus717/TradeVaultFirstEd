'use client';

import { notFound } from 'next/navigation';
import { DEMO_SHOPS, demoMode } from '../../lib/demo';
import { DemoBanner } from '../components/DemoBanner';
import { MeetPanel, type MeetState } from '../inbox/[conversationId]/components/MeetPanel';

const noop = () => undefined;

function meet(status: MeetState['meet_status'], by: string | null): MeetState {
  return {
    meet_shop_id: status === 'none' ? null : DEMO_SHOPS[0].id,
    meet_at: status === 'none' ? null : '2026-11-14T11:00:00Z',
    meet_proposed_by: by,
    meet_status: status,
  };
}

const STATES: [string, MeetState][] = [
  ['Nothing suggested yet', meet('none', null)],
  ['They suggested a shop', meet('proposed', 'them')],
  ['You suggested a shop', meet('proposed', 'me')],
  ['Agreed', meet('agreed', 'me')],
];

// Pages that need a signed-in database session, shown with example data. Only
// exists under `npm run demo`.
export default function PreviewPage() {
  if (!demoMode) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />
        <h1 className="text-3xl font-bold text-white">Meet at a shop</h1>
        {STATES.map(([label, state]) => (
          <div key={label}>
            <h2 className="mb-2 text-sm font-medium text-stone-400">{label}</h2>
            <MeetPanel
              meet={state}
              shops={DEMO_SHOPS}
              userId="me"
              otherName="Sam (example)"
              pending={false}
              error=""
              onPropose={noop}
              onRespond={noop}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
