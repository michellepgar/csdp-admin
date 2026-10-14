-- phase80_security_lockdown.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn. Safe to run again. Requires phase53_chat.sql
-- (chat_my_name()).
--
-- Fixes from the 2026-10 security audit. Until now the database only checked
-- "are you on the team"; the finer rules lived only in the app, and anyone
-- can call the database directly with their own login. This moves the
-- important rules into the database itself:
--   1. The old restore_vas_and_schools() function (deletes and replaces the
--      whole team list, with no checks) can no longer be called directly.
--      It is still used, safely, inside the admin-only school backup restore.
--   2. Only admins can add, change or remove team members, so nobody can
--      make themselves admin or take someone else's name.
--   3. Private notes (and their comments) can only be seen and changed by
--      their author and the people the note is shared with.
--   4. A chat message can only carry an attachment from the sender's own
--      upload folder.
--   5. Signed-out visitors can't run any of the app's database functions.

-- 1. -----------------------------------------------------------------------
revoke execute on function restore_vas_and_schools(jsonb, jsonb) from public, anon, authenticated;

-- 5. Nothing in the app calls a database function while signed out.
revoke execute on all functions in schema public from anon;

-- Who is an admin: same rule as the app (lib/app-state.ts isAdmin) --
-- flagged admin, role owner, or Michelle.
create or replace function is_team_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from vas
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (admin is true or role = 'owner' or name = 'Michelle')
  );
$$;
revoke execute on function is_team_admin() from public, anon;
grant execute on function is_team_admin() to authenticated;

-- 2. -----------------------------------------------------------------------
drop policy if exists "team members can access vas" on vas;
drop policy if exists "team members can read vas" on vas;
drop policy if exists "admins can add vas" on vas;
drop policy if exists "admins can change vas" on vas;
drop policy if exists "admins can remove vas" on vas;

create policy "team members can read vas"
on vas for select
using (auth.uid() is not null and is_team_member());

create policy "admins can add vas"
on vas for insert
with check (auth.uid() is not null and is_team_admin());

create policy "admins can change vas"
on vas for update
using (auth.uid() is not null and is_team_admin())
with check (auth.uid() is not null and is_team_admin());

create policy "admins can remove vas"
on vas for delete
using (auth.uid() is not null and is_team_admin());

-- 3. -----------------------------------------------------------------------
drop policy if exists "team members can access private_notes" on private_notes;
drop policy if exists "private notes: read own or shared" on private_notes;
drop policy if exists "private notes: add own" on private_notes;
drop policy if exists "private notes: change own or shared" on private_notes;
drop policy if exists "private notes: delete own" on private_notes;

create policy "private notes: read own or shared"
on private_notes for select
using (auth.uid() is not null and (author = chat_my_name() or chat_my_name() = any(shared_with)));

create policy "private notes: add own"
on private_notes for insert
with check (auth.uid() is not null and author = chat_my_name());

-- People a note is shared with mark it as seen and move it on their board.
create policy "private notes: change own or shared"
on private_notes for update
using (auth.uid() is not null and (author = chat_my_name() or chat_my_name() = any(shared_with)))
with check (auth.uid() is not null and (author = chat_my_name() or chat_my_name() = any(shared_with)));

create policy "private notes: delete own"
on private_notes for delete
using (auth.uid() is not null and author = chat_my_name());

-- Comments follow their note: the subquery only finds notes you can see.
drop policy if exists "team members can access private_note_comments" on private_note_comments;
drop policy if exists "private note comments: read" on private_note_comments;
drop policy if exists "private note comments: add" on private_note_comments;
drop policy if exists "private note comments: change own" on private_note_comments;
drop policy if exists "private note comments: delete own" on private_note_comments;

create policy "private note comments: read"
on private_note_comments for select
using (auth.uid() is not null and exists (select 1 from private_notes n where n.id = note_id));

create policy "private note comments: add"
on private_note_comments for insert
with check (auth.uid() is not null and author = chat_my_name() and exists (select 1 from private_notes n where n.id = note_id));

create policy "private note comments: change own"
on private_note_comments for update
using (auth.uid() is not null and author = chat_my_name())
with check (auth.uid() is not null and author = chat_my_name());

create policy "private note comments: delete own"
on private_note_comments for delete
using (auth.uid() is not null and author = chat_my_name());

-- When an admin removes a teammate, that person's private notes go too.
-- An admin can't see those notes, so this runs as one checked step.
create or replace function admin_delete_private_notes_by_author(p_author text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_team_admin() then
    raise exception 'Only an admin can do this';
  end if;
  delete from private_notes where author = p_author;
end;
$$;
revoke execute on function admin_delete_private_notes_by_author(text) from public, anon;
grant execute on function admin_delete_private_notes_by_author(text) to authenticated;

-- 4. -----------------------------------------------------------------------
drop policy if exists "send as yourself in rooms you are in" on chat_messages;
create policy "send as yourself in rooms you are in"
on chat_messages for insert
with check (
  chat_can_access(room)
  and sender_name = chat_my_name()
  and (attachment_path is null or attachment_path like auth.uid()::text || '/%')
  and coalesce(attachment_expired, false) = false
  and coalesce(attachment_removed, false) = false
);
