import type { CardVariant, CardVariantType, PokemonCard, PokemonSet } from './types';

export const LEGACY_SET_ID = 'sv3pt5';

const reverseHoloRarities = new Set(['Common', 'Uncommon', 'Rare']);

const preferredSets = [
  { id: 'sv1' },
  { id: 'sv3' },
  { id: 'sv6' },
  { id: 'sv7' },
  { id: 'swsh12' },
  { id: 'sm115' },
  { name: 'Mega Evolution' },
  { name: 'Phantasmal Flames' },
  { name: 'Ascended Heroes' },
  { name: 'Perfect Order' },
  { id: LEGACY_SET_ID },
] as const;

export function compareCardNumbers(a: string, b: string) {
  const matchA = a.match(/^(\d+)(.*)$/);
  const matchB = b.match(/^(\d+)(.*)$/);

  const numberA = matchA ? Number(matchA[1]) : Number.MAX_SAFE_INTEGER;
  const numberB = matchB ? Number(matchB[1]) : Number.MAX_SAFE_INTEGER;

  if (numberA !== numberB) {
    return numberA - numberB;
  }

  const suffixA = matchA?.[2] ?? a;
  const suffixB = matchB?.[2] ?? b;

  return suffixA.localeCompare(suffixB);
}

export function buildVariants(cards: PokemonCard[]): CardVariant[] {
  return cards
    .slice()
    .sort((left, right) => compareCardNumbers(left.number, right.number))
    .flatMap((card) => {
      const variants: CardVariantType[] = ['Normal'];

      if (card.rarity && reverseHoloRarities.has(card.rarity)) {
        variants.push('Reverse Holo');
      }

      return variants.map((variant) => ({
        id: `${card.id}-${variant === 'Normal' ? 'normal' : 'reverse'}`,
        baseCardId: card.id,
        setId: card.set?.id ?? '',
        setName: card.set?.name ?? '',
        name: card.name,
        number: card.number,
        image: card.images?.small ?? '',
        variant,
      }));
    });
}

export function variantSuffix(variant: CardVariantType) {
  return variant === 'Reverse Holo' ? 'reverse' : 'normal';
}

export function buildSetList(allSets: PokemonSet[]) {
  const seen = new Set<string>();
  const byId = new Map(allSets.map((set) => [set.id, set]));
  const byName = new Map(allSets.map((set) => [set.name, set]));

  const preferred = preferredSets
    .map((entry) => ('id' in entry ? byId.get(entry.id) : byName.get(entry.name)))
    .filter((set): set is PokemonSet => Boolean(set))
    .filter((set) => {
      if (seen.has(set.id)) {
        return false;
      }

      seen.add(set.id);
      return true;
    });

  const newest = allSets
    .slice()
    .sort(
      (left, right) =>
        new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime()
    )
    .filter((set) => {
      if (seen.has(set.id)) {
        return false;
      }

      seen.add(set.id);
      return true;
    });

  return [...preferred, ...newest];
}

export function groupSetsBySeries(sets: PokemonSet[]) {
  return sets.reduce<Record<string, PokemonSet[]>>((accumulator, set) => {
    const key = set.series || 'Other';

    if (!accumulator[key]) {
      accumulator[key] = [];
    }

    accumulator[key].push(set);
    return accumulator;
  }, {});
}

