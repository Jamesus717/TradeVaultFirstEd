// Does this id/slug from the URL point at something? Detail pages ask before they
// render, and call Next's notFound() when not, so a bogus id is a real 404.
// Demo mode checks the seeded demo data. Real mode checks the id's shape, then
// (for the public tables only) asks Supabase with the anon key. A lookup that
// errors lets the page render: a slow database must not turn into a 404.

import { createClient } from '@supabase/supabase-js';
import { DEMO_CONVERSATION_IDS, DEMO_SHOPS, demoMode, demoProfileBySlug, demoProfileByUserId } from './demo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

export const isUuid = (value: string) => UUID.test(value);
export const isSlug = (value: string) => SLUG.test(value);

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

// true = exists, false = does not, null = could not tell.
async function lookup(table: string, column: string, value: string): Promise<boolean | null> {
  const client = publicClient();
  if (!client) {
    return null;
  }
  try {
    const { data, error } = await client.from(table).select(column).eq(column, value).limit(1).maybeSingle();
    return error ? null : Boolean(data);
  } catch {
    return null;
  }
}

export async function conversationExists(id: string) {
  if (demoMode) {
    return DEMO_CONVERSATION_IDS.includes(id);
  }
  // Conversations are private (row level security), so only the shape is checked here.
  return isUuid(id);
}

export async function profileExists(userId: string) {
  if (demoMode) {
    return demoProfileByUserId(userId) !== null;
  }
  return isUuid(userId);
}

export async function profileSlugExists(slug: string) {
  if (demoMode) {
    return demoProfileBySlug(slug) !== null;
  }
  return isSlug(slug) && (await lookup('public_profiles', 'profile_slug', slug)) !== false;
}

export async function shopExists(slug: string) {
  if (demoMode) {
    return DEMO_SHOPS.some((shop) => shop.slug === slug);
  }
  return isSlug(slug) && (await lookup('shops', 'slug', slug)) !== false;
}
