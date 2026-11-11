import { describe, expect, it } from 'vitest';
import {
  guideComplete,
  guideSteps,
  NO_PROGRESS,
  parseDemoProgress,
  parseDismissed,
  shouldShowGuide,
} from '../lib/firstRun';

const some = { card: true, want: false, matches: false };
const all = { card: true, want: true, matches: true };

describe('shouldShowGuide', () => {
  it('shows for a new signed-in account', () => {
    expect(shouldShowGuide({ dismissed: false, progress: NO_PROGRESS, canAct: true })).toBe(true);
  });

  it('shows part way through', () => {
    expect(shouldShowGuide({ dismissed: false, progress: some, canAct: true })).toBe(true);
  });

  it('hides once dismissed', () => {
    expect(shouldShowGuide({ dismissed: true, progress: NO_PROGRESS, canAct: true })).toBe(false);
  });

  it('hides when all three steps are done', () => {
    expect(shouldShowGuide({ dismissed: false, progress: all, canAct: true })).toBe(false);
  });

  it('hides while the counts are loading', () => {
    expect(shouldShowGuide({ dismissed: false, progress: null, canAct: true })).toBe(false);
  });

  it('hides for signed-out visitors', () => {
    expect(shouldShowGuide({ dismissed: false, progress: NO_PROGRESS, canAct: false })).toBe(false);
  });
});

describe('guideSteps', () => {
  it('marks the first unfinished step as current', () => {
    const steps = guideSteps(some);
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps.map((s) => s.current)).toEqual([false, true, false]);
  });

  it('has no current step when finished', () => {
    expect(guideSteps(all).some((s) => s.current)).toBe(false);
    expect(guideComplete(all)).toBe(true);
    expect(guideComplete(some)).toBe(false);
  });

  it('keeps the order card, want, matches', () => {
    expect(guideSteps(NO_PROGRESS).map((s) => s.key)).toEqual(['card', 'want', 'matches']);
  });
});

describe('remembered state', () => {
  it('reads the dismissed flag', () => {
    expect(parseDismissed('1')).toBe(true);
    expect(parseDismissed(null)).toBe(false);
    expect(parseDismissed('0')).toBe(false);
  });

  it('reads demo progress and survives bad data', () => {
    expect(parseDemoProgress('{"card":true,"want":true}')).toEqual({ card: true, want: true, matches: false });
    expect(parseDemoProgress('nonsense')).toEqual(NO_PROGRESS);
    expect(parseDemoProgress('null')).toEqual(NO_PROGRESS);
    expect(parseDemoProgress(null)).toEqual(NO_PROGRESS);
  });
});
