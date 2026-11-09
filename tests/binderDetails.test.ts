import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(env: { demo: string; empty: string }) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TB_DEMO', env.demo);
  vi.stubEnv('NEXT_PUBLIC_TB_DEMO_EMPTY', env.empty);
  return import('../lib/binderDetails');
}

afterEach(() => vi.unstubAllEnvs());

describe('demo binder seed', () => {
  it('has example rows in the normal demo', async () => {
    const m = await load({ demo: '1', empty: '' });
    expect(m.getBinderRows().length).toBeGreaterThan(0);
  });
  it('is empty for a brand new demo account', async () => {
    const m = await load({ demo: '1', empty: '1' });
    expect(m.getBinderRows()).toEqual([]);
  });
  it('is empty outside demo mode', async () => {
    const m = await load({ demo: '', empty: '' });
    expect(m.getBinderRows()).toEqual([]);
  });
});
