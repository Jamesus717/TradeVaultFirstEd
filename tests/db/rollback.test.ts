import { describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigrations, bootAtProdState, count, createUser, insertListing, rollbackSql } from './harness';

// Everything in the public schema a migration can add, change or drop.
async function schema(db: PGlite) {
  const parts = {
    columns: `select table_name, column_name, data_type, is_nullable, column_default
              from information_schema.columns where table_schema = 'public'`,
    constraints: `select c.conrelid::regclass::text, c.conname, pg_get_constraintdef(c.oid)
                  from pg_constraint c join pg_namespace n on n.oid = c.connamespace
                  where n.nspname = 'public'`,
    indexes: `select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'`,
    triggers: `select tgrelid::regclass::text, tgname, pg_get_triggerdef(t.oid)
               from pg_trigger t join pg_class r on r.oid = t.tgrelid
               join pg_namespace n on n.oid = r.relnamespace
               where n.nspname = 'public' and not t.tgisinternal`,
    functions: `select p.proname, pg_get_function_identity_arguments(p.oid), md5(p.prosrc),
                p.prosecdef, coalesce(p.proacl::text, '')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'`,
    policies: `select tablename, policyname, cmd, roles::text, coalesce(qual, ''), coalesce(with_check, '')
               from pg_policies where schemaname = 'public'`,
    // card_prices keeps row level security on purpose; see the rollback header.
    rls: `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and relname <> 'card_prices'`,
  };
  const out: Record<string, string[]> = {};
  for (const [name, sql] of Object.entries(parts)) {
    const { rows } = await db.query<Record<string, unknown>>(sql);
    out[name] = rows.map((row) => JSON.stringify(Object.values(row))).sort();
  }
  return out;
}

async function rowsOf(db: PGlite, table: string) {
  const { rows } = await db.query(`select * from public.${table} order by 1, 2`);
  return rows;
}

describe('019-022 rollback', () => {
  it('puts the schema back to before 019 and keeps the old tables rows', async () => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    const misty = await createUser(db, 'misty');
    await db.query(
      `insert into public.user_cards (user_id, card_id, set_id, variant) values ($1, 'sv1-1', 'sv1', 'Normal')`,
      [ash]
    );
    await db.query(
      `insert into public.wishlist_cards (user_id, card_id, card_name) values ($1, 'sv1-2', 'Two')`,
      [misty]
    );
    await insertListing(db, ash, { card_id: 'sv1-1', price: 0 });
    const before = await schema(db);

    await applyMigrations(db, '019', '022');
    // Use the new model a little, as the live site would.
    await db.query(
      `insert into public.inventory_items (user_id, card_id, set_id, variant, status, condition)
       values ($1, 'sv1-9', 'sv1', 'Normal', 'keep', 'NM')`,
      [misty]
    );
    const oldRows = {
      cards: await rowsOf(db, 'user_cards'),
      wishlist: await rowsOf(db, 'wishlist_cards'),
      listings: await count(db, 'public.trade_listings'),
    };

    await db.exec(rollbackSql('019-022_rollback.sql'));

    expect(await schema(db)).toEqual(before);
    expect(await rowsOf(db, 'user_cards')).toEqual(oldRows.cards);
    expect(await rowsOf(db, 'wishlist_cards')).toEqual(oldRows.wishlist);
    expect(await count(db, 'public.trade_listings')).toBe(oldRows.listings);
    const { rows } = await db.query<{ on: boolean }>(
      `select relrowsecurity as on from pg_class where oid = 'public.card_prices'::regclass`
    );
    expect(rows[0].on).toBe(true);

    // Running it a second time is harmless.
    await db.exec(rollbackSql('019-022_rollback.sql'));
    expect(await schema(db)).toEqual(before);
  });

  it('stops, changing nothing, while a listing says Damaged or Ungraded', async () => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    await applyMigrations(db, '019', '022');
    await insertListing(db, ash, { condition: 'Damaged' });

    await expect(db.exec(rollbackSql('019-022_rollback.sql'))).rejects.toThrow(
      /rollback stopped: 1 listings use Damaged or Ungraded/
    );
    await db.exec('rollback');
    expect(await count(db, 'public.inventory_items')).toBe(1);
  });
});

describe('020 condition check and prices', () => {
  it('replaces a condition check whatever it is called', async () => {
    const db = await bootAtProdState();
    await db.exec(
      `alter table public.trade_listings rename constraint trade_listings_condition_check to listings_cond_ck`
    );
    await applyMigrations(db, '019', '020');

    const { rows } = await db.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'public.trade_listings'::regclass and contype = 'c'
         and pg_get_constraintdef(oid) like '%condition%'`
    );
    expect(rows.map((r) => r.conname)).toEqual(['trade_listings_condition_check']);
    const ash = await createUser(db, 'ash');
    await expect(insertListing(db, ash, { condition: 'Ungraded' })).resolves.toBeTruthy();
  });

  it('carries a zero or negative listing price over as no price', async () => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    await insertListing(db, ash, { card_id: 'sv1-1', listing_type: 'sale', price: 0 });
    await insertListing(db, ash, { card_id: 'sv1-2', listing_type: 'sale', price: -5 });
    await insertListing(db, ash, { card_id: 'sv1-3', listing_type: 'sale', price: 4.5 });
    await applyMigrations(db, '019', '020');

    const { rows } = await db.query<{ card_id: string; price: string | null }>(
      `select card_id, price from public.inventory_items order by card_id`
    );
    expect(rows).toEqual([
      { card_id: 'sv1-1', price: null },
      { card_id: 'sv1-2', price: null },
      { card_id: 'sv1-3', price: '4.50' },
    ]);

    // New listings go through the same path.
    await insertListing(db, ash, { card_id: 'sv1-4', listing_type: 'sale', price: 0 });
    expect(await count(db, `public.inventory_items where card_id = 'sv1-4' and price is null`)).toBe(1);
  });
});
