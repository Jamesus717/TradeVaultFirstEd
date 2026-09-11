'use client';

/*
 * Loading placeholder for the conversation view.
 *
 * The page used to show a single small "Loading conversation..." card and then
 * snap to the full two-column layout, which moved everything below it. This
 * mirrors the real geometry instead — the 72px header bar (h-10 thumbnail plus
 * p-4), the h-[60vh] message panel, and the 320px sidebar column — so the
 * layout is already in its final shape when the data lands.
 *
 * Same border/background tokens as the panels it stands in for; no new colours.
 */
export default function ConversationSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-4 flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>

        <section className="flex h-[60vh] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
          <div className="flex-1 space-y-3 overflow-hidden p-5">
            {[
              'w-2/5 self-start',
              'w-1/2 self-end',
              'w-1/3 self-start',
              'w-2/5 self-end',
              'w-1/2 self-start',
            ].map((shape, index) => (
              <div key={`bubble-${index}`} className="flex flex-col">
                <div
                  className={`h-10 animate-pulse rounded-[1.25rem] bg-white/[0.05] ${shape}`}
                />
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-4">
            <div className="h-10 w-full animate-pulse rounded-2xl bg-white/[0.05]" />
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
        <div className="aspect-[3/4] w-full animate-pulse rounded-[1.25rem] bg-white/[0.05]" />
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.06]" />
        </div>
        <div className="h-16 w-full animate-pulse rounded-[1.25rem] bg-white/[0.05]" />
      </aside>
    </div>
  );
}
