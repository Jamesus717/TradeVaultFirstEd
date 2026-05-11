do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_cards'
  ) then
    update public.user_cards
    set variant = 'Unlimited'
    where set_id in (
      'base1','base2','base3','base4','base5',
      'gym1','gym2','neo1','neo2','neo3','neo4'
    )
      and variant in ('Normal', 'Reverse Holo');
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'trade_listings'
  ) then
    update public.trade_listings
    set variant = 'Unlimited'
    where set_id in (
      'base1','base2','base3','base4','base5',
      'gym1','gym2','neo1','neo2','neo3','neo4'
    )
      and variant in ('Normal', 'Reverse Holo');
  end if;
end $$;

