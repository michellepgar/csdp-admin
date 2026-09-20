-- phase61_shift_state.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn. Requires phase53_chat.sql (uses chat_my_name()).
--
-- Remembers, per person, whether they are in the middle of a shift
-- ('working': they clicked Start my day) or finished one ('ended': they
-- clicked End Today's Work). Overview uses it to keep the two buttons in
-- order: Start my day only works when you are not already in a shift, and
-- End Today's Work only works when you are.
--
-- Everyone on the team can read it (Overview shows who is on shift); a
-- person can only change THEIR OWN row.

create table if not exists shift_state (
  va_name text primary key,
  status text not null check (status in ('working', 'ended')),
  changed_at timestamptz not null default now()
);

alter table shift_state enable row level security;

drop policy if exists "team members can read shift state" on shift_state;
create policy "team members can read shift state"
on shift_state for select
using (auth.uid() is not null and is_team_member());

drop policy if exists "write only your own shift state" on shift_state;
create policy "write only your own shift state"
on shift_state for all
using (va_name = chat_my_name())
with check (va_name = chat_my_name());

grant select, insert, update, delete on shift_state to authenticated;
grant select on shift_state to service_role;
