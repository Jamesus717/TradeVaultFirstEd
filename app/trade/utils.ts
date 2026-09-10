import type { ListingCondition, ListingType } from './types';

export const LISTING_COLUMNS =
  'id,user_id,card_id,card_name,set_name,set_id,card_number,variant,condition,listing_type,price,trade_description,postcode_prefix,image_url,card_image_url,created_at,is_active';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function formatMoneyGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

export function formatTimeAgo(iso: string, nowMs: number | null) {
  if (!nowMs) {
    return '';
  }
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return '';
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - created) / 1000));

  if (diffSeconds < 20) {
    return 'just now';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function conditionBadgeClass(condition: ListingCondition) {
  if (condition === 'Mint' || condition === 'Near Mint') {
    return 'bg-primary-400/90 text-primary-950';
  }

  if (condition === 'Lightly Played') {
    return 'bg-amber-400/90 text-amber-950';
  }

  return 'bg-rose-400/90 text-rose-950';
}

export function listingTypeBadge(listingType: ListingType) {
  if (listingType === 'trade') {
    return { label: 'TRADE', className: 'bg-blue-400/90 text-blue-950' };
  }

  if (listingType === 'sale') {
    return { label: 'SALE', className: 'bg-primary-400/90 text-primary-950' };
  }

  return { label: 'TRADE OR SALE', className: 'bg-purple-400/90 text-purple-950' };
}

export function canReverseHolo(rarity?: string) {
  return Boolean(rarity && new Set(['Common', 'Uncommon', 'Rare']).has(rarity));
}

export function normalizePostcodePrefix(value: string) {
  return value.trim().toUpperCase().slice(0, 4);
}
