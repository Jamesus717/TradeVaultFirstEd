do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'trade_listings'
  ) then
    alter table public.trade_listings
      drop constraint if exists trade_listings_variant_check;

    alter table public.trade_listings
      add constraint trade_listings_variant_check
      check (
        variant = any (
          array[
            'Normal'::text,
            'Reverse Holo'::text,
            '1st Edition'::text,
            'Shadowless'::text,
            'Unlimited'::text
          ]
        )
      );
  end if;
end $$;

