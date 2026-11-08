import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigrations, asUser, bootAtProdState, count, createUser, insertListing } from './harness';

// Shape copied from prod's aggregate counts on 2026-11-02 (rows per set and
// per variant). Ids are synthetic; no real user data is used.
const SET_COUNTS: Array<[string | null, string, number]> = [
  ['sv6', 'sv6', 1119], ['sv9', 'sv9', 658], ['sv1', 'sv1', 439], [null, 'sv3pt5', 6],
  ['sv8pt5', 'sv8pt5', 5], ['sv10', 'sv10', 4], ['base3', 'base3', 2], ['base1', 'base1', 1],
  ['swsh12', 'swsh12', 1], ['me55c', 'me55c', 1], ['sm115', 'sm115', 1],
];

const LISTING_COLUMNS = `id, user_id, card_id, card_name, set_name, set_id, card_number, variant, condition,
  listing_type, price, trade_description, postcode_prefix, image_url, card_image_url, created_at, is_active`;

async function fingerprint(db: PGlite, source: string) {
  const { rows } = await db.query<{ s: string }>(
    `select md5(string_agg(t::text, '|' order by t::text)) s from (${source}) t`
  );
  return rows[0].s;
}

describe('020 inventory backfill on a prod-shaped copy', () => {
  let db: PGlite;
  let users: string[];
  let before: { cards: string; wishlist: string; listings: string };

  beforeAll(async () => {
    db = await bootAtProdState();
    users = [];
    for (const name of ['ash', 'misty', 'brock', 'may', 'dawn']) {
      users.push(await createUser(db, name));
    }

    let n = 0;
    for (const [setId, prefix, total] of SET_COUNTS) {
      for (let i = 1; i <= total; i++) {
        n += 1;
        const variant = prefix.startsWith('base') ? 'Unlimited' : i % 5 < 3 ? 'Normal' : 'Reverse Holo';
        await db.query(
          'insert into public.user_cards (user_id, card_id, set_id, variant) values ($1, $2, $3, $4)',
          [users[n % 4], `${prefix}-${i}`, setId, variant]
        );
      }
    }

    await insertListing(db, users[0], { card_id: 'sv2-1', condition: 'Heavily Played', listing_type: 'sale', price: 4 });
    await insertListing(db, users[1], { card_id: 'sv2-2', listing_type: 'either', price: 12.5 });
    await insertListing(db, users[1], { card_id: 'sv2-3', variant: 'Reverse Holo', condition: 'Lightly Played', listing_type: 'sale', price: 3 });
    await insertListing(db, users[2], { card_id: 'base2-1', variant: 'Unlimited', listing_type: 'sale', price: 30 });
    // Not on prod yet but possible by the time this runs: a Mint listing, a
    // sold listing, and a listing of a card ticked in the binder.
    await insertListing(db, users[3], { card_id: 'sv2-9', condition: 'Mint' });
    await insertListing(db, users[3], { card_id: 'sv2-10', is_active: false });
    await db.query(
      `insert into public.user_cards (user_id, card_id, set_id, variant) values ($1, 'sv2-11', 'sv2', 'Normal')`,
      [users[3]]
    );
    await insertListing(db, users[3], { card_id: 'sv2-11' });
    await db.query(
      `insert into public.wishlist_cards (user_id, card_id, card_name, quantity, priority, note)
       values ($1, 'sv1-200', 'Wanted', 3, 'high', 'for a deck')`,
      [users[0]]
    );
    await db.query(
      `insert into public.user_cards (user_id, card_id, set_id, variant, owned) values ($1, 'sv2-50', 'sv2', 'Normal', false)`,
      [users[0]]
    );

    before = {
      cards: await fingerprint(db, 'select id, user_id, card_id, set_id, variant, owned from public.user_cards'),
      wishlist: await fingerprint(db, 'select * from public.wishlist_cards'),
      listings: await fingerprint(db, `select ${LISTING_COLUMNS} from public.trade_listings`),
    };

    await applyMigrations(db, '019', '999');
  });

  it('leaves every old table exactly as it was', async () => {
    expect(await fingerprint(db, 'select id, user_id, card_id, set_id, variant, owned from public.user_cards')).toBe(before.cards);
    expect(await fingerprint(db, 'select * from public.wishlist_cards')).toBe(before.wishlist);
    expect(await fingerprint(db, `select ${LISTING_COLUMNS} from public.trade_listings`)).toBe(before.listings);
  });

  it('carries over every owned card, one for one', async () => {
    const owned = await count(db, 'public.user_cards where owned');
    expect(owned).toBe(2238);
    // One of those moved to for_trade because it is also listed.
    expect(await count(db, `public.inventory_items where status = 'keep'`)).toBe(owned - 1);
    expect(await count(db, `public.inventory_items where status = 'keep' and condition is not null`)).toBe(0);
    expect(await count(db, `public.inventory_items where status <> 'want' and quantity <> 1`)).toBe(0);
  });

  it('fills a null set_id from the card id', async () => {
    expect(await count(db, 'public.inventory_items where set_id is null')).toBe(0);
    expect(await count(db, `public.inventory_items where card_id like 'sv3pt5-%' and set_id = 'sv3pt5'`)).toBe(6);
  });

  it('skips not-owned rows and sold listings', async () => {
    expect(await count(db, `public.inventory_items where card_id in ('sv2-50', 'sv2-10')`)).toBe(0);
  });

  it('carries over listings with their terms, one link each', async () => {
    expect(await count(db, `public.inventory_items where status = 'for_trade'`)).toBe(6);
    expect(await count(db, 'public.inventory_listing_links')).toBe(6);
    const { rows } = await db.query<Record<string, unknown>>(
      `select condition, listing_type, price::text, legacy_condition from public.inventory_items
       where card_id in ('sv2-1', 'sv2-2', 'sv2-9') order by card_id`
    );
    expect(rows).toEqual([
      { condition: 'HP', listing_type: 'sale', price: '4.00', legacy_condition: null },
      { condition: 'NM', listing_type: 'either', price: '12.50', legacy_condition: null },
      { condition: 'NM', listing_type: 'trade', price: null, legacy_condition: 'Mint' },
    ]);
  });

  it('does not count a listed, owned card twice', async () => {
    expect(await count(db, `public.inventory_items where user_id = $1 and card_id = 'sv2-11'`, [users[3]])).toBe(1);
  });

  it('carries over wishlist quantity, priority and note as an Any want', async () => {
    const { rows } = await db.query(
      `select variant, condition, quantity, priority, note from public.inventory_items where status = 'want'`
    );
    expect(rows).toEqual([{ variant: 'Any', condition: null, quantity: 3, priority: 'high', note: 'for a deck' }]);
  });

  it('aborts the whole migration if a row would be left behind', async () => {
    const fresh = await bootAtProdState();
    const user = await createUser(fresh, 'ash');
    await fresh.query(
      `insert into public.user_cards (user_id, card_id, set_id, variant) values ($1, 'sv1-1', 'sv1', 'Normal')`,
      [user]
    );
    await applyMigrations(fresh, '019', '019');
    // Sabotage the backfill: the owned row now has no valid stack to go to.
    await fresh.exec(`alter table public.user_cards add constraint block check (true)`);
    const sql = (await import('./harness')).migrationSql('020_inventory.sql').replace(
      'where owned\non conflict',
      `where owned and false\non conflict`
    );
    expect(sql).toContain('where owned and false');
    await expect(fresh.exec(sql)).rejects.toThrow(/backfill incomplete: 1 owned/);
    await fresh.exec('rollback');
    await expect(fresh.query('select 1 from public.inventory_items')).rejects.toThrow(/does not exist/);
  });

  it('lets a user read everything but write only their own stock', async () => {
    await asUser(db, users[0], async () => {
      const update = await db.query(`update public.inventory_items set quantity = 9 where user_id <> $1`, [users[0]]);
      expect(update.affectedRows).toBe(0);
      await expect(
        db.query(`insert into public.inventory_items (user_id, card_id, variant, status) values ($1, 'x-1', 'Normal', 'keep')`, [users[1]])
      ).rejects.toThrow(/row-level security/);
    });
    await asUser(db, null, async () => {
      expect(await count(db, 'public.inventory_items')).toBeGreaterThan(2000);
      const removed = await db.query('delete from public.inventory_items');
      expect(removed.affectedRows).toBe(0);
    });
  });
});

describe('old and new stay in step', () => {
  let db: PGlite;
  let ash: string;

  beforeAll(async () => {
    db = await bootAtProdState();
    ash = await createUser(db, 'ash');
    await applyMigrations(db, '019', '999');
  });

  const keepRows = () => count(db, `public.inventory_items where user_id = $1 and status = 'keep'`, [ash]);

  it('binder tick and untick mirror into inventory', async () => {
    await asUser(db, ash, () =>
      db.query(`insert into public.user_cards (user_id, card_id, set_id, variant) values ($1, 'sv1-1', 'sv1', 'Normal')`, [ash])
    );
    expect(await keepRows()).toBe(1);
    await asUser(db, ash, () => db.query(`delete from public.user_cards where card_id = 'sv1-1'`));
    expect(await keepRows()).toBe(0);
  });

  it('unticking one of two rows for a card keeps the stack', async () => {
    await db.exec(`alter table public.user_cards disable row level security`);
    await db.query(
      `insert into public.user_cards (user_id, card_id, set_id, variant) values ($1, 'sv1-70', 'sv1', 'Normal'), ($1, 'sv1-70', null, 'Normal')`,
      [ash]
    );
    await db.exec(`alter table public.user_cards enable row level security`);
    await db.query(`delete from public.user_cards where card_id = 'sv1-70' and set_id is null`);
    expect(await count(db, `public.inventory_items where card_id = 'sv1-70' and status = 'keep'`)).toBe(1);
    await db.query(`delete from public.user_cards where card_id = 'sv1-70'`);
    expect(await count(db, `public.inventory_items where card_id = 'sv1-70' and status = 'keep'`)).toBe(0);
  });

  it('a listing put back on sale is stocked again', async () => {
    const listing = await insertListing(db, ash, { card_id: 'sv1-71' });
    await db.query(`update public.trade_listings set is_active = false where id = $1`, [listing]);
    expect(await count(db, `public.inventory_listing_links where listing_id = $1`, [listing])).toBe(0);
    await db.query(`update public.trade_listings set is_active = true where id = $1`, [listing]);
    expect(await count(db, `public.inventory_listing_links where listing_id = $1`, [listing])).toBe(1);
  });

  it('a listing takes the keep copy in its own condition first', async () => {
    await asUser(db, ash, async () => {
      await db.query(`select public.inventory_add('sv1-72', 'keep', 'Normal', 'NM')`);
      await db.query(`select public.inventory_add('sv1-72', 'keep', 'Normal', 'HP')`);
    });
    await insertListing(db, ash, { card_id: 'sv1-72', condition: 'Heavily Played' });
    const { rows } = await db.query<{ condition: string }>(
      `select condition from public.inventory_items where card_id = 'sv1-72' and status = 'keep'`
    );
    expect(rows).toEqual([{ condition: 'NM' }]);
  });

  it('inventory_add stacks up and ticks the binder once', async () => {
    await asUser(db, ash, async () => {
      await db.query(`select public.inventory_add('sv1-2', 'keep', 'Normal', 'NM', 2)`);
      await db.query(`select public.inventory_add('sv1-2', 'keep', 'Normal', 'NM', 1)`);
    });
    expect(await count(db, `public.inventory_items where card_id = 'sv1-2' and quantity = 3`)).toBe(1);
    expect(await count(db, `public.user_cards where card_id = 'sv1-2'`)).toBe(1);
  });

  it('inventory_move splits a stack, and moving back merges it', async () => {
    const { rows } = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-2'`);
    await asUser(db, ash, () => db.query(`select public.inventory_move($1, 'for_trade', 2)`, [rows[0].id]));
    const stacks = await db.query(`select status, quantity from public.inventory_items where card_id = 'sv1-2' order by status`);
    expect(stacks.rows).toEqual([{ status: 'for_trade', quantity: 2 }, { status: 'keep', quantity: 1 }]);
    const trade = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-2' and status = 'for_trade'`);
    await asUser(db, ash, () => db.query(`select public.inventory_move($1, 'keep')`, [trade.rows[0].id]));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-2' and status = 'keep' and quantity = 3`)).toBe(1);
    expect(await count(db, `public.user_cards where card_id = 'sv1-2'`)).toBe(1);
  });

  it('refuses to offer an ungraded stack for trade without a condition', async () => {
    await asUser(db, ash, () => db.query(`select public.inventory_add('sv1-3', 'keep', 'Normal')`));
    const { rows } = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-3'`);
    await asUser(db, ash, async () => {
      await expect(db.query(`select public.inventory_move($1, 'for_trade')`, [rows[0].id])).rejects.toThrow(/set a condition/);
      await db.query(`select public.inventory_move($1, 'for_trade', null, 'LP')`, [rows[0].id]);
    });
    expect(await count(db, `public.inventory_items where card_id = 'sv1-3' and status = 'for_trade' and condition = 'LP'`)).toBe(1);
    expect(await count(db, `public.user_cards where card_id = 'sv1-3'`)).toBe(1);
  });

  it('will not move a stack owned by someone else', async () => {
    const misty = await createUser(db, 'misty');
    const { rows } = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-3'`);
    await asUser(db, misty, async () => {
      await expect(db.query(`select public.inventory_move($1, 'keep')`, [rows[0].id])).rejects.toThrow(/not yours/);
    });
  });

  it('removing the last owned copy unticks the binder', async () => {
    await asUser(db, ash, () => db.query(`delete from public.inventory_items where card_id = 'sv1-3'`));
    expect(await count(db, `public.user_cards where card_id = 'sv1-3'`)).toBe(0);
  });

  it('wishlist writes mirror both ways', async () => {
    await asUser(db, ash, () =>
      db.query(`insert into public.wishlist_cards (user_id, card_id, card_name, quantity) values ($1, 'sv1-4', 'Four', 2)`, [ash])
    );
    expect(await count(db, `public.inventory_items where card_id = 'sv1-4' and status = 'want' and quantity = 2`)).toBe(1);
    await asUser(db, ash, () => db.query(`update public.wishlist_cards set quantity = 5 where card_id = 'sv1-4'`));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-4' and quantity = 5`)).toBe(1);
    await asUser(db, ash, () => db.query(`select public.inventory_add('sv1-5', 'want', 'Any', null, 1, null, 'Five')`));
    expect(await count(db, `public.wishlist_cards where card_id = 'sv1-5' and card_name = 'Five'`)).toBe(1);
    await asUser(db, ash, () => db.query(`delete from public.inventory_items where card_id = 'sv1-5'`));
    expect(await count(db, `public.wishlist_cards where card_id = 'sv1-5'`)).toBe(0);
    await asUser(db, ash, () => db.query(`delete from public.wishlist_cards where card_id = 'sv1-4'`));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-4'`)).toBe(0);
  });

  it('a new listing moves a kept copy to for trade, deleting it moves it back', async () => {
    await asUser(db, ash, () => db.query(`select public.inventory_add('sv1-6', 'keep', 'Normal')`));
    const listing = await asUser(db, ash, () => insertListing(db, ash, { card_id: 'sv1-6' }));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-6' and status = 'for_trade'`)).toBe(1);
    expect(await count(db, `public.inventory_items where card_id = 'sv1-6' and status = 'keep'`)).toBe(0);
    await asUser(db, ash, () => db.query(`delete from public.trade_listings where id = $1`, [listing]));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-6' and status = 'keep'`)).toBe(1);
    expect(await count(db, `public.inventory_items where card_id = 'sv1-6' and status = 'for_trade'`)).toBe(0);
  });

  it('selling removes the copy from stock but leaves the binder alone', async () => {
    await asUser(db, ash, () => db.query(`select public.inventory_add('sv1-7', 'keep', 'Normal')`));
    const listing = await asUser(db, ash, () => insertListing(db, ash, { card_id: 'sv1-7' }));
    await asUser(db, ash, () => db.query(`update public.trade_listings set is_active = false where id = $1`, [listing]));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-7'`)).toBe(0);
    expect(await count(db, `public.user_cards where card_id = 'sv1-7'`)).toBe(1);
  });

  it('will not move a stack that has a live listing', async () => {
    await asUser(db, ash, () => insertListing(db, ash, { card_id: 'sv1-8' }));
    const { rows } = await db.query<{ id: string }>(`select id from public.inventory_items where card_id = 'sv1-8'`);
    await asUser(db, ash, async () => {
      await expect(db.query(`select public.inventory_move($1, 'keep')`, [rows[0].id])).rejects.toThrow(/live listing/);
    });
  });

  it('two listings of the same stack share it', async () => {
    const one = await asUser(db, ash, () => insertListing(db, ash, { card_id: 'sv1-9' }));
    await asUser(db, ash, () => insertListing(db, ash, { card_id: 'sv1-9' }));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-9' and quantity = 2`)).toBe(1);
    await asUser(db, ash, () => db.query(`update public.trade_listings set is_active = false where id = $1`, [one]));
    expect(await count(db, `public.inventory_items where card_id = 'sv1-9' and quantity = 1`)).toBe(1);
    expect(
      await count(db, `public.inventory_listing_links k join public.trade_listings t on t.id = k.listing_id where t.card_id = 'sv1-9'`)
    ).toBe(1);
  });

  it('deleting a user clears their inventory with no errors', async () => {
    const gone = await createUser(db, 'goner');
    await asUser(db, gone, async () => {
      await db.query(`select public.inventory_add('sv1-1', 'keep', 'Normal')`);
      await db.query(`select public.inventory_add('sv1-2', 'want', 'Any')`);
      await insertListing(db, gone, { card_id: 'sv1-3' });
    });
    await db.query('delete from auth.users where id = $1', [gone]);
    expect(await count(db, 'public.inventory_items where user_id = $1', [gone])).toBe(0);
  });
});
