'use client';

/*
 * Loading placeholder for the binder grid.
 *
 * The page used to show a single 10-rem-tall "Loading set data..." card and
 * then replace it with the filter panel plus the whole card grid, which moved
 * everything on the page. This mirrors the real geometry instead: the same
 * grid column counts and gap as BinderGrid, and per card the same
 * rounded-[1.5rem] border, p-3 padding, aspect-[5/7] image well, three text
 * lines and footer button.
 *
 * Same border/background tokens as the real cards; no new colours, no new
 * spacing values.
 */
export function BinderGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {/* Stands in for the filter / search panel above the grid. */}
      <div className="panel p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-8 w-56 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-9 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-[38px] animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="h-[38px] animate-pulse rounded-xl bg-white/[0.06]" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="h-[30px] w-28 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-[30px] w-24 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-[30px] w-24 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
        <div className="mt-1 h-5 w-48 animate-pulse rounded bg-white/[0.06]" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: count }).map((_, index) => (
          <div key={`binder-skeleton-${index}`}>
            <div className="aspect-[63/88] w-full animate-pulse rounded-[4.5%/3.2%] bg-white/[0.05] ring-1 ring-white/5" />
            <div className="mt-2.5 space-y-1 px-0.5">
              <div className="h-5 w-4/5 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-4 w-10 animate-pulse rounded bg-white/[0.06]" />
            </div>
            <div className="mt-2 h-11 w-full animate-pulse rounded-xl bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}
