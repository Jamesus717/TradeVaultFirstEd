import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, bootLatest, count, createUser, insertListing } from './harness';

type MatchRow = { trader_id: string; direction: string; card_id: string; item_id: string; tradable: number; is_spare: boolean };

describe('get_trade_matches', () => {
  let db: PGlite;
  let ash: string;
  let misty: string;
  let brock: string;

  const add = (user: string, card: string, status: string, variant = 'Normal', condition: string | null = 'NM', quantity = 1) =>
    asUser(db, user, () =>
      db.query(`select public.inventory_add($1, $2, $3, $4, $5)`, [card, status, variant, condition, quantity])
    );

  const matchesFor = (user: string, shop: string | null = null) =>
    asUser(db, user, async () => (await db.query<MatchRow>('select * from public.get_trade_matches($1)', [shop])).rows);

  beforeAll(async () => {
    db = await bootLatest();
    ash = await createUser(db, 'ash');
    misty = await createUser(db, 'misty');
    brock = await createUser(db, 'brock');
  });

  it('finds both directions of a trade', async () => {
    await add(ash, 'sv1-1', 'want', 'Any', null);
    await add(misty, 'sv1-1', 'for_trade');
    await add(ash, 'sv1-2', 'for_trade');
    await add(misty, 'sv1-2', 'want', 'Any', null);

    const rows = await matchesFor(ash);
    expect(rows.map((r) => [r.direction, r.card_id]).sort()).toEqual([['i_have', 'sv1-2'], ['they_have', 'sv1-1']]);
    expect(rows.every((r) => r.trader_id === misty)).toBe(true);
  });

  it('counts spares, but never your only copy', async () => {
    await add(ash, 'sv1-3', 'want', 'Any', null);
    await add(ash, 'sv1-4', 'want', 'Any', null);
    await add(brock, 'sv1-3', 'keep', 'Normal', 'NM', 3);
    await add(brock, 'sv1-4', 'keep', 'Normal', 'NM', 1);

    const rows = (await matchesFor(ash)).filter((r) => r.trader_id === brock);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ card_id: 'sv1-3', tradable: 2, is_spare: true });
  });

  it('respects a wanted variant and worst condition', async () => {
    await add(ash, 'sv1-5', 'want', 'Reverse Holo', 'LP');
    await add(misty, 'sv1-5', 'for_trade', 'Normal', 'NM');
    await add(brock, 'sv1-5', 'for_trade', 'Reverse Holo', 'MP');
    expect((await matchesFor(ash)).filter((r) => r.card_id === 'sv1-5')).toHaveLength(0);

    await add(misty, 'sv1-5', 'for_trade', 'Reverse Holo', 'LP');
    expect((await matchesFor(ash)).filter((r) => r.card_id === 'sv1-5')).toHaveLength(1);
  });

  it('shows ungraded cards rather than hiding them', async () => {
    await add(ash, 'sv1-6', 'want', 'Any', 'NM');
    await add(brock, 'sv1-6', 'keep', 'Normal', null, 2);
    expect((await matchesFor(ash)).filter((r) => r.card_id === 'sv1-6')).toHaveLength(1);
  });

  it('ignores your own stock', async () => {
    await add(ash, 'sv1-7', 'want', 'Any', null);
    await add(ash, 'sv1-7', 'for_trade');
    expect((await matchesFor(ash)).filter((r) => r.card_id === 'sv1-7')).toHaveLength(0);
  });

  it('filters to traders at a shop', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.shops (slug, name, status) values ('home', 'Home', 'active') returning id`
    );
    await asUser(db, misty, () => db.query('insert into public.user_shops (user_id, shop_id) values ($1, $2)', [misty, rows[0].id]));
    const scoped = await matchesFor(ash, rows[0].id);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((r) => r.trader_id === misty)).toBe(true);
  });

  it('returns nothing when signed out and refuses anon', async () => {
    await asUser(db, null, async () => {
      await expect(db.query('select * from public.get_trade_matches()')).rejects.toThrow(/permission denied/);
    });
  });

  describe('start_match_conversation', () => {
    it('uses an item\'s listing when it has one', async () => {
      const listing = await insertListing(db, brock, { card_id: 'sv1-20' });
      const { rows } = await db.query<{ item_id: string }>('select item_id from public.inventory_listing_links where listing_id = $1', [listing]);
      const result = await asUser(db, ash, () =>
        db.query<{ id: string }>('select public.start_match_conversation($1) as id', [rows[0].item_id])
      );
      expect(await count(db, 'public.conversations where id = $1 and listing_id = $2 and buyer_id = $3 and seller_id = $4', [result.rows[0].id, listing, ash, brock])).toBe(1);
    });

    it('makes a plain listing for stock that has none, once', async () => {
      await add(brock, 'sv1-21', 'for_trade', 'Normal', 'LP');
      const { rows } = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-21'`);
      const start = () =>
        asUser(db, ash, () => db.query<{ id: string }>('select public.start_match_conversation($1) as id', [rows[0].id]));
      const first = await start();
      expect(first.rows[0].id).toBeTruthy();
      await expect(start()).rejects.toThrow(/already have a chat about this card/);
      expect(await count(db, `public.trade_listings where card_id = 'sv1-21' and condition = 'Lightly Played' and listing_type = 'trade'`)).toBe(1);
      expect(await count(db, `public.inventory_items where card_id = 'sv1-21' and quantity = 1`)).toBe(1);
    });

    it('labels an ungraded spare honestly', async () => {
      await add(brock, 'sv1-22', 'keep', 'Normal', null, 2);
      const { rows } = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-22'`);
      await asUser(db, ash, () => db.query('select public.start_match_conversation($1)', [rows[0].id]));
      expect(await count(db, `public.trade_listings where card_id = 'sv1-22' and condition = 'Ungraded' and trade_description = 'Spare copy'`)).toBe(1);
    });

    it('refuses a sole keep copy, a want and your own card', async () => {
      await add(brock, 'sv1-23', 'keep', 'Normal', 'NM', 1);
      await add(brock, 'sv1-24', 'want', 'Any', null);
      await add(ash, 'sv1-25', 'for_trade');
      const { rows } = await db.query<{ id: string; card_id: string }>(
        `select id, card_id from public.inventory_items where card_id in ('sv1-23', 'sv1-24', 'sv1-25') order by card_id`
      );
      await asUser(db, ash, async () => {
        await expect(db.query('select public.start_match_conversation($1)', [rows[0].id])).rejects.toThrow(/no longer available/);
        await expect(db.query('select public.start_match_conversation($1)', [rows[1].id])).rejects.toThrow(/no longer available/);
        await expect(db.query('select public.start_match_conversation($1)', [rows[2].id])).rejects.toThrow(/yours/);
      });
    });
  });
});
