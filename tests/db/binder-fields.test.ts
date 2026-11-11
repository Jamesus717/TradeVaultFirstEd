import { describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bootAtProdState, count, createUser } from './harness';

const PROPOSALS = join(__dirname, '..', '..', 'supabase', 'proposals');
const proposal = (file: string) => readFileSync(join(PROPOSALS, file), 'utf8').replace(/\r\n/g, '\n');
const apply = (db: PGlite) => db.exec(proposal('024_binder_fields.sql'));

async function columns(db: PGlite) {
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'user_cards' order by 1`
  );
  return rows.map((r) => r.column_name);
}

async function checks(db: PGlite) {
  const { rows } = await db.query<{ conname: string }>(
    `select conname from pg_constraint
     where conrelid = 'public.user_cards'::regclass and contype = 'c' order by 1`
  );
  return rows.map((r) => r.conname);
}

async function add(db: PGlite, user: string, id: string, extra: Record<string, unknown> = {}) {
  const row = { user_id: user, card_id: id, set_id: 'sv1', variant: 'Normal', ...extra };
  const keys = Object.keys(row);
  await db.query(
    `insert into public.user_cards (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row)
  );
}

describe('024 binder fields', () => {
  it('is not in supabase/migrations, so nothing applies it by accident', () => {
    expect(readdirSync(join(PROPOSALS, '..', 'migrations')).some((f) => f.startsWith('024'))).toBe(false);
  });

  it('adds condition, qty and price, keeping existing rows at qty 1', async () => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    await add(db, ash, 'sv1-1');
    const before = await columns(db);
    await apply(db);

    expect(await columns(db)).toEqual([...before, 'condition', 'price', 'qty'].sort());
    const { rows } = await db.query(`select condition, qty, price from public.user_cards`);
    expect(rows).toEqual([{ condition: null, qty: 1, price: null }]);

    // Applying twice is harmless.
    await apply(db);
    expect(await count(db, 'public.user_cards')).toBe(1);
  });

  it('accepts good values and the old upsert shape', async () => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    await apply(db);
    await add(db, ash, 'sv1-1', { condition: 'DMG', qty: 999, price: 12.5 });
    await add(db, ash, 'sv1-2', { owned: true });
    expect(await count(db, 'public.user_cards')).toBe(2);
  });

  it.each([
    ['condition', { condition: 'MINT' }],
    ['qty', { qty: 0 }],
    ['qty', { qty: 1000 }],
    ['price', { price: 0 }],
    ['price', { price: -1 }],
    ['price', { price: 1000000 }],
  ])('rejects a bad %s', async (_name, extra) => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    await apply(db);
    await expect(add(db, ash, 'sv1-1', extra)).rejects.toThrow(/check constraint/);
  });

  it('rollback removes the columns and checks, keeps rows, and is repeatable', async () => {
    const db = await bootAtProdState();
    const ash = await createUser(db, 'ash');
    await add(db, ash, 'sv1-1');
    const beforeColumns = await columns(db);
    const beforeChecks = await checks(db);

    await apply(db);
    await add(db, ash, 'sv1-2', { condition: 'NM', qty: 2, price: 3 });

    await db.exec(proposal('024_binder_fields_rollback.sql'));
    expect(await columns(db)).toEqual(beforeColumns);
    expect(await checks(db)).toEqual(beforeChecks);
    expect(await count(db, 'public.user_cards')).toBe(2);

    await db.exec(proposal('024_binder_fields_rollback.sql'));
    expect(await columns(db)).toEqual(beforeColumns);
  });
});
