import type { CardVariantType } from '../../app/binder/types';

export type { CardVariantType };

export const NO_REVERSE_HOLO_SETS = new Set([
  'base1',
  'base2',
  'base3',
  'base4',
  'base5',
  'teamrocket',
  'gym1',
  'gym2',
  'neo1',
  'neo2',
  'neo3',
  'neo4',
]);

export const FIRST_EDITION_SETS = new Set([
  'base1',
  'base2',
  'base3',
  'base5',
  'gym1',
  'gym2',
  'neo1',
  'neo2',
  'neo3',
  'neo4',
]);

export const SHADOWLESS_SETS = new Set(['base1']);

export const UNLIMITED_ONLY_SETS = new Set(['base4']);

export function getVariantsForSet(setId: string): CardVariantType[] {
  if (SHADOWLESS_SETS.has(setId)) {
    return ['1st Edition', 'Shadowless', 'Unlimited'];
  }
  if (FIRST_EDITION_SETS.has(setId)) {
    return ['1st Edition', 'Unlimited'];
  }
  if (UNLIMITED_ONLY_SETS.has(setId)) {
    return ['Unlimited'];
  }
  return ['Normal', 'Reverse Holo'];
}

export function variantToSlug(variant: CardVariantType): string {
  const map: Record<CardVariantType, string> = {
    Normal: 'normal',
    'Reverse Holo': 'reverse',
    '1st Edition': '1st',
    Shadowless: 'shadowless',
    Unlimited: 'unlimited',
  };
  return map[variant];
}

export function normalizeVariantForSet(setId: string, variant: CardVariantType): CardVariantType {
  if (NO_REVERSE_HOLO_SETS.has(setId) && (variant === 'Normal' || variant === 'Reverse Holo')) {
    return 'Unlimited';
  }
  return variant;
}
