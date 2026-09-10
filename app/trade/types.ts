export type ListingVariant = 'Normal' | 'Reverse Holo' | '1st Edition' | 'Shadowless' | 'Unlimited';

export type ListingCondition =
  | 'Mint'
  | 'Near Mint'
  | 'Lightly Played'
  | 'Moderately Played'
  | 'Heavily Played';

export type ListingType = 'trade' | 'sale' | 'either';

export type TradeListing = {
  id: string;
  user_id: string;
  card_id: string;
  card_name: string;
  set_name: string;
  set_id: string;
  card_number: string;
  variant: ListingVariant;
  condition: ListingCondition;
  listing_type: ListingType;
  price: number | null;
  trade_description: string | null;
  postcode_prefix: string | null;
  image_url: string | null;
  card_image_url: string | null;
  created_at: string;
  is_active: boolean;
};

export type CardSearchResult = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: { id: string; name: string; series: string; releaseDate?: string };
  images?: { small?: string; large?: string };
};

export type CardSearchMode = 'collection' | 'all';

export type ListingTypeFilter = 'all' | 'trade' | 'sale';

export type TradeBoardStats = {
  activeListings: number;
  tradersToday: number;
  setsRepresented: number;
};
