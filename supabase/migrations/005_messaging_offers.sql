create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.trade_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(listing_id, buyer_id)
);

create index if not exists conversations_buyer_id_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations (seller_id);
create index if not exists conversations_listing_id_idx on public.conversations (listing_id);
create index if not exists conversations_updated_at_desc_idx on public.conversations (updated_at desc);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  content text,
  message_type text not null default 'message' check (message_type in ('message', 'offer', 'system')),
  offer_amount numeric(10,2),
  offer_status text check (offer_status in ('pending', 'accepted', 'declined', 'countered')),
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_created_at_idx on public.messages (conversation_id, created_at);

create or replace function public.validate_message_insert()
returns trigger
language plpgsql
as $$
begin
  if new.message_type = 'message' then
    if new.sender_id is null or new.content is null or btrim(new.content) = '' then
      raise exception 'message content required';
    end if;
    new.offer_amount := null;
    new.offer_status := null;
  elsif new.message_type = 'offer' then
    if new.sender_id is null then
      raise exception 'offer sender required';
    end if;
    if new.offer_amount is null or new.offer_status is null then
      raise exception 'offer requires amount and status';
    end if;
    if new.content is null then
      new.content := '';
    end if;
  else
    if new.sender_id is not null and (new.content is null or btrim(new.content) = '') then
      raise exception 'system message content required when sender provided';
    end if;
    if new.content is null then
      new.content := '';
    end if;
    new.offer_amount := null;
    new.offer_status := null;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_message_insert_trigger on public.messages;
create trigger validate_message_insert_trigger
before insert on public.messages
for each row
execute function public.validate_message_insert();

create or replace function public.bump_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists bump_conversation_updated_at_trigger on public.messages;
create trigger bump_conversation_updated_at_trigger
after insert on public.messages
for each row
execute function public.bump_conversation_updated_at();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('new_message', 'new_offer', 'offer_accepted', 'offer_declined', 'offer_countered', 'trade_completed')),
  conversation_id uuid references public.conversations(id) on delete cascade,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists notifications_user_read_created_at_desc_idx on public.notifications (user_id, read, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Participants can view conversations" on public.conversations;
create policy "Participants can view conversations"
on public.conversations
for select
using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can start conversations" on public.conversations;
create policy "Buyers can start conversations"
on public.conversations
for insert
with check (auth.uid() = buyer_id);

drop policy if exists "Participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
on public.conversations
for update
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Participants can view messages" on public.messages;
create policy "Participants can view messages"
on public.messages
for select
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "Participants can insert messages into active conversations" on public.messages;
create policy "Participants can insert messages into active conversations"
on public.messages
for insert
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.status = 'active'
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
  and (
    (message_type = 'system' and sender_id is null)
    or (sender_id = auth.uid())
  )
);

drop policy if exists "Participants can update messages in conversation (read receipts)" on public.messages;
create policy "Participants can update messages in conversation (read receipts)"
on public.messages
for update
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications
for delete
using (auth.uid() = user_id);

drop policy if exists "Participants can notify other participant" on public.notifications;
create policy "Participants can notify other participant"
on public.notifications
for insert
with check (
  auth.uid() <> user_id
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and auth.uid() in (c.buyer_id, c.seller_id)
      and user_id in (c.buyer_id, c.seller_id)
  )
);

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

