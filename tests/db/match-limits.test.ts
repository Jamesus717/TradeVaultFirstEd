import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, bootLatest, count, createUser, insertListing } from './harness';

// Borty's decisions of 2026-11-08 on review findings 5 (matching spam) and 6
// (privacy), as built in 022.

describe('match limits and owner opt-out', () => {
  let db: PGlite;
  let ash: string;
  let misty: string;

  // A fresh for-trade stack owned by `owner`, one per card id.
  async function stock(owner: string, card: string) {
    await asUser(db, owner, () => db.query(`select public.inventory_add($1, 'for_trade', 'Normal', 'NM', 1)`, [card]));
    const { rows } = await db.query<{ id: string }>(
      `select id from public.inventory_items where user_id = $1 and card_id = $2`,
      [owner, card]
    );
    return rows[0].id;
  }

  const start = (user: string, item: string) =>
    asUser(db, user, () => db.query<{ id: string }>('select public.start_match_conversation($1) as id', [item]));

  beforeEach(async () => {
    db = await bootLatest();
    ash = await createUser(db, 'ash');
    misty = await createUser(db, 'misty');
  });

  it('seeds the free plan at 10 a day, read from the database', async () => {
    const { rows } = await db.query<{ plan: string; match_daily_limit: number }>('select * from public.plan_limits');
    expect(rows).toEqual([{ plan: 'free', match_daily_limit: 10 }]);
  });

  it('allows the 10th new match chat in 24 hours and refuses the 11th', async () => {
    for (let n = 1; n <= 10; n++) {
      const item = await stock(misty, `sv1-${n}`);
      await expect(start(ash, item)).resolves.toBeTruthy();
    }
    expect(await count(db, 'public.match_requests where user_id = $1', [ash])).toBe(10);

    const eleventh = await stock(misty, 'sv1-11');
    await expect(start(ash, eleventh)).rejects.toThrow(/Daily match limit reached, resets in 24 h/);
    // Nothing was made for the refused one.
    expect(await count(db, `public.trade_listings where card_id = 'sv1-11'`)).toBe(0);
    expect(await count(db, 'public.conversations where buyer_id = $1', [ash])).toBe(10);

    const allowance = await asUser(db, ash, () =>
      db.query<{ daily_limit: number; used: number }>('select daily_limit, used from public.get_match_allowance()')
    );
    expect(allowance.rows[0]).toEqual({ daily_limit: 10, used: 10 });
  });

  it('says when the oldest chat leaves the window, and frees the slot after 24 hours', async () => {
    for (let n = 1; n <= 10; n++) {
      await start(ash, await stock(misty, `sv2-${n}`));
    }
    // The oldest was 20 hours ago: one slot frees up in 4 hours.
    await db.query(
      `update public.match_requests set created_at = now() - interval '20 hours'
       where id = (select id from public.match_requests where user_id = $1 order by created_at, id limit 1)`,
      [ash]
    );
    const next = await stock(misty, 'sv2-11');
    await expect(start(ash, next)).rejects.toThrow(/resets in 4 h/);

    await db.query(`update public.match_requests set created_at = now() - interval '25 hours' where user_id = $1`, [ash]);
    await expect(start(ash, next)).resolves.toBeTruthy();
  });

  it('gives a higher tier more by changing data only', async () => {
    await db.query(`insert into public.plan_limits (plan, match_daily_limit) values ('plus', 11)`);
    await db.query(`insert into public.user_plans (user_id, plan) values ($1, 'plus')`, [ash]);
    for (let n = 1; n <= 11; n++) {
      await start(ash, await stock(misty, `sv3-${n}`));
    }
    await expect(start(ash, await stock(misty, 'sv3-12'))).rejects.toThrow(/Daily match limit reached/);
  });

  it('refuses a second chat on the same listing and points at the first', async () => {
    const item = await stock(misty, 'sv4-1');
    const first = await start(ash, item);
    const second = start(ash, item);
    await expect(second).rejects.toThrow(/already have a chat about this card/);
    await expect(second).rejects.toMatchObject({ detail: first.rows[0].id });
    expect(await count(db, 'public.conversations where buyer_id = $1', [ash])).toBe(1);
    expect(await count(db, 'public.match_requests where user_id = $1', [ash])).toBe(1);
  });

  it('refuses a match chat on a listing the user already messages about from the trade board', async () => {
    const listing = await insertListing(db, misty, { card_id: 'sv4-2' });
    const { rows } = await db.query<{ id: string }>(
      `insert into public.conversations (listing_id, buyer_id, seller_id) values ($1, $2, $3) returning id`,
      [listing, ash, misty]
    );
    const link = await db.query<{ item_id: string }>(
      'select item_id from public.inventory_listing_links where listing_id = $1',
      [listing]
    );
    await expect(start(ash, link.rows[0].item_id)).rejects.toMatchObject({
      message: 'you already have a chat about this card',
      detail: rows[0].id,
    });
  });

  it('refuses when the owner has turned match requests off, and says so in matches', async () => {
    const item = await stock(misty, 'sv5-1');
    await asUser(db, ash, () => db.query(`select public.inventory_add('sv5-1', 'want', 'Any', null, 1)`));
    await asUser(db, misty, () =>
      db.query('update public.public_profiles set allow_match_requests = false where user_id = $1', [misty])
    );

    await expect(start(ash, item)).rejects.toThrow(/not taking match requests/);
    expect(await count(db, 'public.match_requests')).toBe(0);

    const matches = await asUser(db, ash, () =>
      db.query<{ accepts_requests: boolean }>('select accepts_requests from public.get_trade_matches()')
    );
    expect(matches.rows).toEqual([{ accepts_requests: false }]);
  });

  it('defaults to accepting match requests', async () => {
    const { rows } = await db.query<{ allow_match_requests: boolean }>(
      'select allow_match_requests from public.public_profiles where user_id = $1',
      [misty]
    );
    expect(rows[0].allow_match_requests).toBe(true);
  });

  it('keeps the limit tables out of client hands', async () => {
    await asUser(db, ash, async () => {
      await expect(db.query(`insert into public.user_plans (user_id, plan) values ($1, 'free')`, [ash])).rejects.toThrow(
        /row-level security/
      );
      await expect(
        db.query(`insert into public.match_requests (user_id) values ($1)`, [ash])
      ).rejects.toThrow(/row-level security/);
      await expect(db.query(`update public.plan_limits set match_daily_limit = 999`)).resolves.toMatchObject({
        affectedRows: 0,
      });
      await expect(db.query('select public.tb_match_daily_limit($1)', [ash])).rejects.toThrow(/permission denied/);
    });
    expect(await count(db, `public.plan_limits where match_daily_limit = 10`)).toBe(1);
  });
});

describe('inventory privacy', () => {
  let db: PGlite;
  let ash: string;
  let misty: string;

  beforeEach(async () => {
    db = await bootLatest();
    ash = await createUser(db, 'ash');
    misty = await createUser(db, 'misty');
    await insertListing(db, misty, {
      card_id: 'sv6-1',
      postcode_prefix: 'LS1',
      listing_type: 'sale',
      price: 4.5,
      image_url: 'https://example.test/photo.jpg',
    });
    await asUser(db, misty, () => db.query(`select public.inventory_add('sv6-2', 'want', 'Any', null, 1)`));
  });

  for (const who of ['anon', 'another user'] as const) {
    it(`hides postcode_prefix from ${who}`, async () => {
      await asUser(db, who === 'anon' ? null : ash, async () => {
        await expect(db.query('select postcode_prefix from public.inventory_items')).rejects.toThrow(/permission denied/);
        await expect(db.query('select * from public.inventory_items')).rejects.toThrow(/permission denied/);
        if (who !== 'anon') {
          const { rows } = await db.query('select * from public.my_inventory_postcodes()');
          expect(rows).toEqual([]);
        }
      });
    });

    it(`still shows ${who} the card, condition, quantity, price, photo and wants`, async () => {
      const { rows } = await asUser(db, who === 'anon' ? null : ash, () =>
        db.query<Record<string, unknown>>(
          `select card_id, set_id, condition, quantity, price, photo_url, status
           from public.inventory_items where user_id = $1 order by card_id`,
          [misty]
        )
      );
      expect(rows).toEqual([
        { card_id: 'sv6-1', set_id: 'sv1', condition: 'NM', quantity: 1, price: '4.50', photo_url: 'https://example.test/photo.jpg', status: 'for_trade' },
        { card_id: 'sv6-2', set_id: 'sv6', condition: null, quantity: 1, price: null, photo_url: null, status: 'want' },
      ]);
    });
  }

  it('lets the owner read their own postcode_prefix', async () => {
    const { rows } = await asUser(db, misty, () =>
      db.query<{ postcode_prefix: string }>('select postcode_prefix from public.my_inventory_postcodes()')
    );
    expect(rows).toEqual([{ postcode_prefix: 'LS1' }]);
  });

  it('owners still add and move stock with the column grant in place', async () => {
    await asUser(db, ash, async () => {
      const added = await db.query<{ id: string; quantity: number }>(
        `select id, quantity from public.inventory_add('sv6-3', 'keep', 'Normal', 'NM', 2)`
      );
      expect(added.rows[0].quantity).toBe(2);
      const moved = await db.query<{ status: string; quantity: number }>(
        `select status, quantity from public.inventory_move($1, 'for_trade', 1)`,
        [added.rows[0].id]
      );
      expect(moved.rows[0]).toEqual({ status: 'for_trade', quantity: 1 });
    });
  });

  it('never shows a shop map position', async () => {
    await db.query(`insert into public.shops (slug, name, town, lat, lng, status) values ('leeds-shop', 'S', 'Leeds', 53.8, -1.5, 'active')`);
    await asUser(db, null, async () => {
      await expect(db.query('select lat, lng from public.shops')).rejects.toThrow(/permission denied/);
      const { rows } = await db.query('select name, town from public.shops');
      expect(rows).toEqual([{ name: 'S', town: 'Leeds' }]);
    });
  });
});
