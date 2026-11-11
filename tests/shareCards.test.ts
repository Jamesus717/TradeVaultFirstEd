import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(demo: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TB_DEMO', demo ? '1' : '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  return import('../lib/shareCards');
}

afterEach(() => vi.unstubAllEnvs());

describe('top card selection', () => {
  it('takes the 3 highest priced, once each, skipping unnamed', async () => {
    const { pickTopCards } = await load(true);
    const rows = [
      { card_id: 'a', price: 5 },
      { card_id: 'b', price: 50 },
      { card_id: 'b', price: 50 },
      { card_id: 'c', price: 20 },
      { card_id: 'd', price: 10 },
      { card_id: 'x', price: 999 },
    ];
    expect(pickTopCards(rows, { a: 'A', b: 'B', c: 'C', d: 'D' })).toEqual(['B', 'C', 'D']);
  });
});

describe('profile card', () => {
  it('never includes hidden fields, even if the row carries them', async () => {
    const { buildProfileCard, cardMetadata } = await load(true);
    const row = {
      display_name: 'Sam',
      username: 'sam',
      postcode_prefix: 'LS1',
      email: 'sam@example.com',
      user_id: 'secret-user-id',
      address: '1 Example Street',
    };
    const card = buildProfileCard(row, 12, ['Charizard', 'Zapdos', 'Mew', 'Extra']);
    const out = JSON.stringify([card, cardMetadata(card, '/u/sam')]);
    for (const hidden of ['LS1', 'sam@example.com', 'secret-user-id', 'Example Street', 'Extra']) {
      expect(out).not.toContain(hidden);
    }
    expect(card.topCards).toHaveLength(3);
    expect(card.stat).toBe('12');
    expect(card.title).toBe('Sam on TradeBinder');
  });

  it('falls back to username, then a generic name', async () => {
    const { buildProfileCard } = await load(true);
    expect(buildProfileCard({ display_name: ' ', username: 'sam' }, 1, []).heading).toBe('sam');
    expect(buildProfileCard({ display_name: null, username: null }, 0, []).heading).toBe('A collector');
  });
});

describe('shop card', () => {
  it('uses name, town and games only', async () => {
    const { buildShopCard } = await load(true);
    const card = buildShopCard({
      name: 'Example Cards Leeds',
      town: 'Leeds',
      games: ['pokemon'],
      ...({ postcode_prefix: 'LS1', address: '1 Example Street' } as object),
    } as never);
    const out = JSON.stringify(card);
    expect(out).toContain('Leeds');
    expect(out).not.toContain('LS1');
    expect(out).not.toContain('Example Street');
  });
});

describe('loaders', () => {
  it('return the generic card for unknown slugs and when there is no database', async () => {
    const demo = await load(true);
    expect(await demo.loadProfileCard('nope')).toBe(demo.GENERIC_CARD);
    expect(await demo.loadShopCard('nope')).toBe(demo.GENERIC_CARD);
    const real = await load(false);
    expect(await real.loadProfileCard('sam')).toBe(real.GENERIC_CARD);
    expect(await real.loadShopCard('../etc/passwd')).toBe(real.GENERIC_CARD);
  });

  it('build real cards for the demo profile and shop', async () => {
    const demo = await load(true);
    const profile = await demo.loadProfileCard('sam');
    expect(profile.kind).toBe('profile');
    expect(profile.topCards.length).toBeLessThanOrEqual(3);
    expect((await demo.loadShopCard('example-cards-leeds')).kind).toBe('shop');
  });
});
