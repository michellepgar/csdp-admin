-- phase56_chat_realtime_private.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- This project only allows PRIVATE realtime channels ("Allow public
-- access" is off, per phase36_team_presence.sql). The chat's live-delivery
-- channel used to open as a public one, so Supabase rejected it every few
-- seconds ("PrivateOnly: This project only allows private channels") and
-- messages only arrived through the app's 20-second background check.
-- The app now opens it as a private channel named 'chat-messages'; this
-- lets signed-in team members join it. (What each person actually SEES is
-- still decided by the chat_messages row-level security -- a private chat's
-- messages only ever reach the two people in it.)

drop policy if exists "team members can receive chat channel" on realtime.messages;

create policy "team members can receive chat channel"
on realtime.messages for select
to authenticated
using (
  realtime.topic() = 'chat-messages'
  and public.is_team_member()
);
