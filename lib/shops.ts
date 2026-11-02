import { demoMode, DEMO_SHOPS } from './demo';
import { isNotMigrated } from './matching';
import { supabase } from './supabaseClient';

export type Shop = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  town: string | null;
  postcode_prefix: string | null;
  website: string | null;
  opening_hours: string | null;
  games: string[];
  featured_until: string | null;
};

const SHOP_COLUMNS =
  'id, slug, name, description, address, town, postcode_prefix, website, opening_hours, games, featured_until';

// Empty until 021 is applied and a shop has agreed to be listed.
export async function loadShops(): Promise<Shop[]> {
  if (demoMode) {
    return DEMO_SHOPS;
  }
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from('shops').select(SHOP_COLUMNS).order('name');
  if (error) {
    if (isNotMigrated(error)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as Shop[];
}

export function shopPlace(shop: Pick<Shop, 'town' | 'postcode_prefix'>) {
  return [shop.town, shop.postcode_prefix].filter(Boolean).join(', ');
}

export function isFeatured(shop: Pick<Shop, 'featured_until'>, now: number) {
  return shop.featured_until !== null && new Date(shop.featured_until).getTime() > now;
}

// Paying shops first, then by name.
export function sortShops<T extends Pick<Shop, 'featured_until' | 'name'>>(shops: T[], now: number) {
  return [...shops].sort(
    (a, b) => Number(isFeatured(b, now)) - Number(isFeatured(a, now)) || a.name.localeCompare(b.name)
  );
}
