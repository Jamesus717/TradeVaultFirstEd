export type PokemonSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
};

export type SetApiResponse = {
  data?: PokemonSet[];
};

export type PokemonCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: {
    id: string;
    name: string;
    series: string;
  };
  images?: {
    small?: string;
  };
};

export type CardApiResponse = {
  data?: PokemonCard[];
};

export type CardVariantType = 'Normal' | 'Reverse Holo';

export type CardVariant = {
  id: string;
  baseCardId: string;
  setId: string;
  setName: string;
  name: string;
  number: string;
  image: string;
  variant: CardVariantType;
};

export type UserCardRow = {
  card_id: string;
  set_id: string | null;
  variant: CardVariantType;
  owned: boolean;
};

export type SortMode = 'binder' | 'number-desc' | 'name-asc' | 'owned-first';

