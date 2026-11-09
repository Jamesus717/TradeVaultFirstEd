// The first-run guide on Home: add a card, add a want, see matches.
// Pure logic only (what to show, what to remember), so it is easy to test.

export type StepKey = 'card' | 'want' | 'matches';

export type Progress = Record<StepKey, boolean>;

export const DISMISS_KEY = 'tv-first-run-dismissed';
export const DEMO_PROGRESS_KEY = 'tv-first-run-demo-progress';

export const NO_PROGRESS: Progress = { card: false, want: false, matches: false };

export const GUIDE_STEPS: { key: StepKey; title: string; body: string; href: string; action: string }[] = [
  {
    key: 'card',
    title: 'Add your first card',
    body: 'Tick off a card you own in the Binder.',
    href: '/binder',
    action: 'Open the Binder',
  },
  {
    key: 'want',
    title: 'Add a want',
    body: 'Search for a card you are after and add it to your wishlist.',
    href: '/wishlist',
    action: 'Open the wishlist',
  },
  {
    key: 'matches',
    title: 'See your matches',
    body: 'We find traders who have what you want and want what you have.',
    href: '/matches',
    action: 'See matches',
  },
];

export type GuideStep = (typeof GUIDE_STEPS)[number] & { done: boolean; current: boolean };

/** The steps with their done state. The first unfinished step is the current one. */
export function guideSteps(progress: Progress): GuideStep[] {
  const firstOpen = GUIDE_STEPS.findIndex((step) => !progress[step.key]);
  return GUIDE_STEPS.map((step, index) => ({
    ...step,
    done: progress[step.key],
    current: index === firstOpen,
  }));
}

export function guideComplete(progress: Progress) {
  return GUIDE_STEPS.every((step) => progress[step.key]);
}

/**
 * Show the guide only to someone who can act on it (signed in, or the demo),
 * once the counts have loaded, who has not dismissed it and is not finished.
 */
export function shouldShowGuide(input: { dismissed: boolean; progress: Progress | null; canAct: boolean }) {
  if (!input.canAct || input.dismissed || !input.progress) return false;
  return !guideComplete(input.progress);
}

export function parseDismissed(raw: string | null | undefined) {
  return raw === '1';
}

/** Demo has no database, so a step counts as done once its link was opened. */
export function parseDemoProgress(raw: string | null | undefined): Progress {
  if (!raw) return NO_PROGRESS;
  try {
    const value = JSON.parse(raw) as Partial<Record<StepKey, unknown>> | null;
    return {
      card: value?.card === true,
      want: value?.want === true,
      matches: value?.matches === true,
    };
  } catch {
    return NO_PROGRESS;
  }
}
