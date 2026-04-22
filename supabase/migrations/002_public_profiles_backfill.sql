insert into public.public_profiles (user_id, username, profile_slug, display_name)
select
  u.id,
  'user-' || substr(u.id::text, 1, 8),
  'user-' || substr(u.id::text, 1, 8),
  null
from auth.users u
left join public.public_profiles p on p.user_id = u.id
where p.user_id is null;

