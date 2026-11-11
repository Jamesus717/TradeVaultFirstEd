import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bootLatest, migrationFiles } from './harness';

// All proposals together, on top of every migration, in number order. Nothing
// here touches a real database: PGlite only.
const PROPOSALS = join(__dirname, '..', '..', 'supabase', 'proposals');
const read = (file: string) => readFileSync(join(PROPOSALS, file), 'utf8').replace(/\r\n/g, '\n');
const all = readdirSync(PROPOSALS).filter((f) => f.endsWith('.sql')).sort();
const ups = all.filter((f) => !f.endsWith('_rollback.sql'));
const num = (f: string) => Number(f.slice(0, 3));

async function columns(db: Awaited<ReturnType<typeof bootLatest>>, table: string) {
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by 1`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

describe('proposal migrations', () => {
  it('are numbered one after another, right after the last real migration', () => {
    const last = Math.max(...migrationFiles().map(num));
    expect(ups.map(num)).toEqual(ups.map((_, i) => last + 1 + i));
  });

  it('each has a rollback and none share a number with a migration', () => {
    const taken = new Set(migrationFiles().map(num));
    for (const up of ups) {
      expect(all).toContain(up.replace(/\.sql$/, '_rollback.sql'));
      expect(taken.has(num(up))).toBe(false);
    }
  });

  it('apply in order on the latest schema, then roll back in reverse', async () => {
    const db = await bootLatest();
    const wishlistBefore = await columns(db, 'wishlist_cards');
    const cardsBefore = await columns(db, 'user_cards');

    for (const up of ups) await db.exec(read(up));
    expect(await columns(db, 'wishlist_cards')).toContain('target_price');
    expect(await columns(db, 'user_cards')).toEqual(expect.arrayContaining(['condition', 'qty', 'price']));

    for (const up of [...ups].reverse()) await db.exec(read(up.replace(/\.sql$/, '_rollback.sql')));
    expect(await columns(db, 'wishlist_cards')).toEqual(wishlistBefore);
    expect(await columns(db, 'user_cards')).toEqual(cardsBefore);
    await db.close();
  });
});
