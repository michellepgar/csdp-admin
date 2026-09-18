-- phase47_mentions.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Backs @mentions (Issue Comments + General Notes, see
-- docs/superpowers/specs/2026-09-18-comment-redesign-mentions-
-- notifications-design.md). One row per (mentioned person, place they
-- were mentioned). issue_id/note_id are mutually exclusive depending
-- on `source` -- whichever one applies is how a bell-dropdown click
-- navigates back to the mention (see lib/app-state.ts's Mention type).

create table if not exists mentions (
  id text primary key default gen_random_uuid()::text,
  mentioned_name text not null,
  mentioner_name text not null,
  source text not null check (source in ('issue_comment', 'general_note')),
  issue_id text references issues(id) on delete cascade,
  note_id text references general_notes(id) on delete cascade,
  snippet text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table mentions enable row level security;

drop policy if exists "team members can access mentions" on mentions;
create policy "team members can access mentions"
on mentions for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, insert, update, delete on mentions to authenticated;
