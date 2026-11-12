import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { pokemonCachedJson } from '../lib/pokemonServer';

const cards = { data: [{ id: 'base1-1' }] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pokemonCachedJson fallback', () => {
  it('uses the fallback when upstream answers 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));

    const response = await pokemonCachedJson('/cards?q=5xx', 1000, undefined, async () => cards);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Fallback')).toBe('1');
    expect(await response.json()).toEqual(cards);
  });

  it('uses the fallback when upstream is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));

    const response = await pokemonCachedJson('/cards?q=down', 1000, undefined, async () => cards);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Fallback')).toBe('1');
    expect(await response.json()).toEqual(cards);
  });

  it('still reports 502 when upstream is unreachable and there is no fallback answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));

    const response = await pokemonCachedJson('/cards?q=none', 1000, undefined, async () => null);

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('passes a 4xx through without asking the fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })));
    const fallback = vi.fn(async () => cards);

    const response = await pokemonCachedJson('/sets/nope', 1000, undefined, fallback);

    expect(response.status).toBe(404);
    expect(fallback).not.toHaveBeenCalled();
  });
});
