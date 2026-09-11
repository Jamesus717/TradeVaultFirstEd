'use client';

import type { ConversationStatus } from '../types';

export default function ClosedConversationNotice({
  status,
  onMarkCompleted,
  completing,
}: {
  status: ConversationStatus;
  onMarkCompleted: () => void;
  completing: boolean;
}) {
  return (
    <div className="border-t border-white/10 p-4 text-center text-sm text-stone-300">
      {status === 'accepted' ? (
        <div className="space-y-3">
          <p>Offer accepted. Mark this trade as completed when you’re done.</p>
          <button
            type="button"
            onClick={onMarkCompleted}
            disabled={completing}
            className={`inline-flex rounded-2xl bg-primary-400 px-4 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300 ${
              completing ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {completing ? 'Marking…' : 'Mark as Completed'}
          </button>
        </div>
      ) : (
        <p>This conversation is {status}.</p>
      )}
    </div>
  );
}
