-- phase49_note_comments.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Generalizes Issues & Concerns' comment thread to General Notes and
-- Private Notes (see docs/superpowers/specs/2026-09-18-rich-comments-
-- everywhere-design.md), adds edit tracking to every comment table,
-- and makes every comment's text safe to render as HTML (screenshots,
-- links, @mentions) instead of plain text.

create table if not exists general_note_comments (
  id text primary key default gen_random_uuid()::text,
  note_id text not null references general_notes(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

alter table general_note_comments enable row level security;

drop policy if exists "team members can access general_note_comments" on general_note_comments;
create policy "team members can access general_note_comments"
on general_note_comments for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, insert, update, delete on general_note_comments to authenticated;

alter table general_notes add column if not exists comment_ack_by text[] not null default '{}';

-- private_note_comments deliberately gets the SAME team-wide RLS as
-- every other table, not a per-row author-or-shared-with restriction
-- -- private_notes ITSELF is only gated by is_team_member() at the DB
-- level (its real "only the author and whoever it's shared with can
-- see this" rule is enforced in application code, via
-- visiblePrivateNotes() in lib/app-state.ts, before a note ever
-- crosses the server/client boundary). A comment attached to a
-- private note the current viewer can't see never reaches them either,
-- because the note it's attached to is filtered out first -- matching
-- that existing precedent instead of inventing a new, inconsistent
-- access-control mechanism for just this one table.
create table if not exists private_note_comments (
  id text primary key default gen_random_uuid()::text,
  note_id text not null references private_notes(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

alter table private_note_comments enable row level security;

drop policy if exists "team members can access private_note_comments" on private_note_comments;
create policy "team members can access private_note_comments"
on private_note_comments for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, insert, update, delete on private_note_comments to authenticated;

alter table private_notes add column if not exists comment_ack_by text[] not null default '{}';

alter table issue_comments add column if not exists edited_at timestamptz;

-- One-time: every existing issue_comments.text value is raw plain
-- text, never sanitized -- rendering it through the same
-- dangerouslySetInnerHTML pipeline every rich comment now uses would
-- treat a literal "<"/">"/"&" in an old comment as real markup. This
-- escapes them in place so every row, old or new, is valid safe HTML
-- from here on -- no visible change to what's already on screen (an
-- escaped "<" still displays as "<").
update issue_comments
set text = replace(replace(replace(text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
