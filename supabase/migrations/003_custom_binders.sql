create table if not exists public.custom_binders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists custom_binders_user_id_idx on public.custom_binders (user_id);

create table if not exists public.custom_binder_cards (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references public.custom_binders (id) on delete cascade,
  card_id text not null,
  set_id text,
  card_name text,
  card_number text,
  image_url text,
  created_at timestamptz not null default now(),
  unique (binder_id, card_id)
);

create index if not exists custom_binder_cards_binder_id_idx on public.custom_binder_cards (binder_id);

alter table public.custom_binders enable row level security;
alter table public.custom_binder_cards enable row level security;

drop policy if exists "Custom binders are readable by owner" on public.custom_binders;
create policy "Custom binders are readable by owner"
on public.custom_binders
for select
using (auth.uid() = user_id);

drop policy if exists "Custom binders are insertable by owner" on public.custom_binders;
create policy "Custom binders are insertable by owner"
on public.custom_binders
for insert
with check (auth.uid() = user_id);

drop policy if exists "Custom binders are updatable by owner" on public.custom_binders;
create policy "Custom binders are updatable by owner"
on public.custom_binders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Custom binders are deletable by owner" on public.custom_binders;
create policy "Custom binders are deletable by owner"
on public.custom_binders
for delete
using (auth.uid() = user_id);

drop policy if exists "Custom binder cards are readable by binder owner" on public.custom_binder_cards;
create policy "Custom binder cards are readable by binder owner"
on public.custom_binder_cards
for select
using (
  exists (
    select 1
    from public.custom_binders b
    where b.id = binder_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Custom binder cards are insertable by binder owner" on public.custom_binder_cards;
create policy "Custom binder cards are insertable by binder owner"
on public.custom_binder_cards
for insert
with check (
  exists (
    select 1
    from public.custom_binders b
    where b.id = binder_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Custom binder cards are deletable by binder owner" on public.custom_binder_cards;
create policy "Custom binder cards are deletable by binder owner"
on public.custom_binder_cards
for delete
using (
  exists (
    select 1
    from public.custom_binders b
    where b.id = binder_id
      and b.user_id = auth.uid()
  )
);

drop trigger if exists set_custom_binders_updated_at on public.custom_binders;
create trigger set_custom_binders_updated_at
before update on public.custom_binders
for each row
execute function public.set_updated_at();

