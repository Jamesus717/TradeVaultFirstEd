import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

// The parts of a Supabase project our migrations lean on.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema storage;
  grant usage on schema auth, public, storage to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  create publication supabase_realtime;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

// Windows checkouts get CRLF; tests that patch the SQL match on LF.
export function migrationSql(file: string) {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
}

export function ownsTransaction(sql: string) {
  return /^begin;$/m.test(sql) && /^commit;$/m.test(sql);
}

export function rollbackSql(file: string) {
  return readFileSync(join(MIGRATIONS_DIR, '..', 'rollback', file), 'utf8').replace(/\r\n/g, '\n');
}

export async function applyMigrations(db: PGlite, from: string, to: string) {
  for (const file of migrationFiles()) {
    const number = file.slice(0, 3);
    if (number >= from && number <= to) {
      // Supabase runs a migration as one transaction, so do the same for files
      // that don't open their own (019 onwards do).
      const sql = migrationSql(file);
      await db.exec(ownsTransaction(sql) ? sql : `begin;\n${sql}\ncommit;`);
    }
  }
}

// Fresh database at the state of prod today: migrations up to 018, plus the
// known drift (prod's user_cards never had created_at).
export async function bootAtProdState() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await applyMigrations(db, '000', '018');
  await db.exec('alter table public.user_cards drop column created_at;');
  return db;
}

export async function bootLatest() {
  const db = await bootAtProdState();
  await applyMigrations(db, '019', '999');
  return db;
}

export async function createUser(db: PGlite, username: string) {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [`${username}@example.test`, JSON.stringify({ username })]
  );
  return rows[0].id;
}

// Runs fn as a signed-in user through RLS, the way PostgREST does.
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export async function count(db: PGlite, sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params);
  return rows[0].n;
}

export async function insertListing(
  db: PGlite,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const row = {
    user_id: userId,
    card_id: 'sv1-25',
    card_name: 'Test Card',
    set_name: 'Scarlet & Violet',
    set_id: 'sv1',
    card_number: '25',
    variant: 'Normal',
    condition: 'Near Mint',
    listing_type: 'trade',
    ...overrides,
  };
  const keys = Object.keys(row);
  const { rows } = await db.query<{ id: string }>(
    `insert into public.trade_listings (${keys.join(', ')})
     values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(row)
  );
  return rows[0].id;
}
