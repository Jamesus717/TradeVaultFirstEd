import { demoMode } from '../../lib/demo';

export function DemoBanner() {
  if (!demoMode) {
    return null;
  }

  return (
    <p className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
      Preview with example data. These traders and shops are not real.
    </p>
  );
}
