import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(demo: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TB_DEMO', demo ? '1' : '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  return import('../lib/detailRoutes');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('../app/shops/[slug]/ShopClient');
});

describe('detail routes in demo mode', () => {
  it('knows the seeded demo ids', async () => {
    const routes = await load(true);
    expect(await routes.conversationExists('demo-chat-1')).toBe(true);
    expect(await routes.profileExists('demo-sam')).toBe(true);
    expect(await routes.profileSlugExists('sam')).toBe(true);
    expect(await routes.shopExists('example-cards-leeds')).toBe(true);
  });

  it('rejects made-up ids', async () => {
    const routes = await load(true);
    expect(await routes.conversationExists('nope')).toBe(false);
    expect(await routes.profileExists('nope')).toBe(false);
    expect(await routes.profileSlugExists('nope')).toBe(false);
    expect(await routes.shopExists('nope')).toBe(false);
  });
});

describe('detail routes in real mode', () => {
  it('rejects ids that are the wrong shape without asking the database', async () => {
    const routes = await load(false);
    expect(await routes.conversationExists('not-a-uuid')).toBe(false);
    expect(await routes.profileExists('demo-sam')).toBe(false);
    expect(await routes.shopExists('../etc/passwd')).toBe(false);
    expect(await routes.shopExists('x'.repeat(200))).toBe(false);
    expect(await routes.profileSlugExists('has space')).toBe(false);
  });

  it('accepts a well-formed id and lets a slug through when there is no database to ask', async () => {
    const routes = await load(false);
    expect(await routes.conversationExists('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(await routes.profileExists('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(await routes.shopExists('some-shop')).toBe(true);
  });
});

describe('detail pages', () => {
  it('call notFound() for an unknown id, so it is a 404 and not a 500', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_TB_DEMO', '1');
    vi.doMock('../app/shops/[slug]/ShopClient', () => ({ default: () => null }));
    const { default: ShopPage } = await import('../app/shops/[slug]/page');

    await expect(ShopPage({ params: Promise.resolve({ slug: 'bogus' }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    await expect(ShopPage({ params: Promise.resolve({ slug: 'example-cards-leeds' }) })).resolves.toBeTruthy();
  });
});
