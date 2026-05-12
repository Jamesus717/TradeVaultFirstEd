CREATE TABLE IF NOT EXISTS public.card_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id text NOT NULL UNIQUE,
  card_name text NOT NULL,
  set_name text,
  price_low numeric(10,2),
  price_mid numeric(10,2),
  price_high numeric(10,2),
  currency text DEFAULT 'GBP',
  sample_size integer,
  source text DEFAULT 'ebay_uk',
  fetched_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_prices_card_id 
  ON public.card_prices(card_id);