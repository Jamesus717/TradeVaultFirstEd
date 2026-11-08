import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, bootLatest, createUser, migrationFiles } from './harness';
import { findUnderTarget, type CachedPrice, type WishlistTarget } from '../../lib/priceAlerts';

const PROPOSALS = join(__dirname, '..', '..', 'supabase', 'proposals');
const proposal = (file: string) => readFileSync(join(PROPOSALS, file), 'utf8').replace(/\r\n/g, '\n');
const UP = proposal('023_wishlist_target_price.sql');
const DOWN = proposal('023_wishlist_target_price_rollback.sql');

async function wishlistColumns(db: PGlite) {
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'wishlist_cards' order by column_name`
  );
  return rows.map((row) => row.column_name);
}

describe('023 proposal: wishlist target prices', () => {
  let db: PGlite;
  let ash: string;
  let misty: string;

  beforeAll(async () => {
    db = await bootLatest();
    ash = await createUser(db, 'ash');
    misty = await createUser(db, 'misty');
    await db.query(
      `insert into public.wishlist_cards (user_id, card_id, card_name) values
       ($1, 'base1-4', 'Charizard'), ($1, 'base1-2', 'Blastoise'), ($1, 'base1-58', 'Pikachu')`,
      [ash]
    );
    await db.exec(UP);
  });

  it('stays out of supabase/migrations, so nothing applies it by accident', () => {
    expect(migrationFiles().some((file) => file.startsWith('023'))).toBe(false);
    expect(UP).toMatch(/^begin;$/m);
    expect(UP).toMatch(/^commit;$/m);
  });

  it('adds a nullable target_price and leaves existing rows without one', async () => {
    expect(await wishlistColumns(db)).toContain('target_price');
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.wishlist_cards where target_price is not null`
    );
    expect(rows[0].n).toBe(0);
  });

  it('rejects zero, negative and absurd targets', async () => {
    for (const bad of ['0', '-1', '100000.01']) {
      await expect(
        db.query(`update public.wishlist_cards set target_price = $1 where card_id = 'base1-4'`, [bad])
      ).rejects.toThrow(/wishlist_cards_target_price_check/);
    }
  });

  it('lets the owner set a target and stops anyone else', async () => {
    await asUser(db, ash, () =>
      db.query(`update public.wishlist_cards set target_price = 250 where card_id = 'base1-4'`)
    );
    const changed = await asUser(db, misty, () =>
      db.query(`update public.wishlist_cards set target_price = 1 where user_id = $1`, [ash])
    );
    expect(changed.affectedRows).toBe(0);
    const { rows } = await db.query<{ target_price: string }>(
      `select target_price from public.wishlist_cards where card_id = 'base1-4'`
    );
    expect(rows[0].target_price).toBe('250.00');
  });

  it('feeds findUnderTarget straight from the database rows', async () => {
    await db.query(`update public.wishlist_cards set target_price = 90 where card_id = 'base1-2'`);
    await db.query(
      `insert into public.card_prices (card_id, card_name, price_mid, currency, fetched_at) values
       ('base1-4', 'Charizard', 231.40, 'GBP', now() - interval '3 hours'),
       ('base1-2', 'Blastoise', 104.90, 'GBP', now() - interval '3 hours'),
       ('base1-58', 'Pikachu', 6.10, 'GBP', now())`
    );
    // Read as the signed-in user, the way the wishlist page does.
    const { wishlist, prices } = await asUser(db, ash, async () => ({
      wishlist: (
        await db.query<WishlistTarget>(
          `select id, card_id, card_name, set_name, card_number, image_url, target_price
           from public.wishlist_cards where user_id = $1`,
          [ash]
        )
      ).rows,
      prices: (
        await db.query<CachedPrice & { fetched_at: Date | string }>(
          `select card_id, price_mid, currency, fetched_at from public.card_prices`
        )
      ).rows,
    }));
    const asStrings = prices.map((row) => ({ ...row, fetched_at: new Date(row.fetched_at).toISOString() }));

    const alerts = findUnderTarget(wishlist, asStrings, { nowMs: Date.now() });
    expect(alerts.map((alert) => [alert.cardName, alert.price, alert.target])).toEqual([['Charizard', 231.4, 250]]);
  });

  it('rolls back to the 022 shape, keeps the rows, and can run twice', async () => {
    await db.exec(UP); // applying again is harmless
    await db.exec(DOWN);
    expect(await wishlistColumns(db)).not.toContain('target_price');
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.wishlist_cards`);
    expect(rows[0].n).toBe(3);
    await db.exec(DOWN);

    const fresh = await bootLatest();
    expect(await wishlistColumns(db)).toEqual(await wishlistColumns(fresh));
    const constraints = async (target: PGlite) =>
      (
        await target.query<{ conname: string }>(
          `select conname from pg_constraint where conrelid = 'public.wishlist_cards'::regclass order by conname`
        )
      ).rows;
    expect(await constraints(db)).toEqual(await constraints(fresh));
  });
});
