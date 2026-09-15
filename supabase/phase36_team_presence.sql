-- phase36_team_presence.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn before the team-presence UI is deployed.
--
-- This permits only an authenticated CSDP team member to subscribe to
-- and publish Supabase Presence state for the single private channel.
-- It does not store activity in a public database table.

drop policy if exists "team members can receive team presence" on realtime.messages;
drop policy if exists "team members can send team presence" on realtime.messages;

create policy "team members can receive team presence"
on realtime.messages for select
to authenticated
using (
  realtime.topic() = 'team-presence'
  and realtime.messages.extension() = 'presence'
  and public.is_team_member()
);

create policy "team members can send team presence"
on realtime.messages for insert
to authenticated
with check (
  realtime.topic() = 'team-presence'
  and realtime.messages.extension() = 'presence'
  and public.is_team_member()
);
