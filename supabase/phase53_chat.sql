-- phase53_chat.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn.
--
-- Team chat: one shared "team" room plus private 1:1 rooms ("dm:A|B",
-- the two names sorted). Private stays private -- the row-level
-- security below only lets the two people in a DM (not admins, not
-- anyone else on the team) read or write it.
--
-- Same identity convention as the rest of the app: a person is their
-- NAME in vas (chat_my_name() looks it up from the signed-in email).

create or replace function chat_my_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select name from vas
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function chat_can_access(p_room text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null or not is_team_member() then false
    when p_room = 'team' then true
    when p_room like 'dm:%' then chat_my_name() = any(string_to_array(substr(p_room, 4), '|'))
    else false
  end;
$$;

create table if not exists chat_messages (
  id text primary key default gen_random_uuid()::text,
  room text not null,
  sender_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx on chat_messages (room, created_at desc);

create table if not exists chat_reads (
  reader_name text not null,
  room text not null,
  last_read_at timestamptz not null default now(),
  primary key (reader_name, room)
);

alter table chat_messages enable row level security;
alter table chat_reads enable row level security;

drop policy if exists "read rooms you are in" on chat_messages;
create policy "read rooms you are in"
on chat_messages for select
using (chat_can_access(room));

drop policy if exists "send as yourself in rooms you are in" on chat_messages;
create policy "send as yourself in rooms you are in"
on chat_messages for insert
with check (chat_can_access(room) and sender_name = chat_my_name());

drop policy if exists "own read markers" on chat_reads;
create policy "own read markers"
on chat_reads for all
using (reader_name = chat_my_name())
with check (reader_name = chat_my_name());

grant select, insert on chat_messages to authenticated;
grant select, insert, update on chat_reads to authenticated;

-- Live delivery: lets the app subscribe to new messages (still filtered
-- by the row-level security above).
do $$
begin
  alter publication supabase_realtime add table chat_messages;
exception when duplicate_object then null;
end $$;
