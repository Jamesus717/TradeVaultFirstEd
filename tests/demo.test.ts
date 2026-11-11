import { describe, expect, it } from 'vitest';
import { DEMO_MATCHES, DEMO_SHOPS, demoListings, demoMatches, demoShopByListing } from '../lib/demo';

describe('demo data', () => {
  it('shows every trader with no shop chosen and only that shop\'s traders with one', () => {
    expect(demoMatches('')).toEqual(DEMO_MATCHES);

    const leeds = new Set(demoMatches('demo-1').map((match) => match.trader_id));
    expect(leeds).toEqual(new Set(['demo-sam', 'demo-robin']));
  });

  it('gives every shop chip at least one trader, and every trader a shop', () => {
    for (const shop of DEMO_SHOPS) {
      expect(demoMatches(shop.id).length).toBeGreaterThan(0);
    }
    expect(DEMO_SHOPS.flatMap((shop) => demoMatches(shop.id))).toHaveLength(DEMO_MATCHES.length);
  });

  it('never shows a made-up price and lists newest first', () => {
    const listings = demoListings(Date.parse('2026-11-02T12:00:00Z'));

    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((listing) => listing.price === null)).toBe(true);

    const times = listings.map((listing) => Date.parse(listing.created_at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('links each listing to a real demo shop', () => {
    const listings = demoListings(0);
    const shopByListing = demoShopByListing(listings);
    const shopIds = new Set(DEMO_SHOPS.map((shop) => shop.id));

    for (const listing of listings) {
      expect(shopIds.has(shopByListing[listing.id])).toBe(true);
    }
  });
});

describe('demo detail data', () => {
  it('builds a conversation for each seeded chat id and none for a made-up one', async () => {
    const { DEMO_CONVERSATION_IDS, DEMO_ME, demoConversation } = await import('../lib/demo');
    for (const id of DEMO_CONVERSATION_IDS) {
      const demo = demoConversation(id, 0);
      expect(demo?.conversation.buyer_id).toBe(DEMO_ME);
      expect(demo?.messages.length).toBeGreaterThan(0);
      expect(Object.keys(demo?.profiles ?? {})).toEqual([demo?.conversation.seller_id]);
    }
    expect(demoConversation('made-up', 0)).toBeNull();
  });

  it('finds a profile by user id and by slug', async () => {
    const { demoProfileBySlug, demoProfileByUserId } = await import('../lib/demo');
    expect(demoProfileByUserId('demo-sam')?.profile_slug).toBe('sam');
    expect(demoProfileBySlug('sam')?.user_id).toBe('demo-sam');
    expect(demoProfileBySlug('made-up')).toBeNull();
  });
});
