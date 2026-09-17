-- phase46_issue_comments.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Replaces each issue's single free-text Note/Fix field with a real
-- comment thread (components/issue-comments.tsx). comment_ack_by
-- tracks who has seen the LATEST comment -- addIssueComment resets it
-- to just the poster's own name on every new comment, which is what
-- drives the blinking "new comment" dot for everyone else.

create table if not exists issue_comments (
  id text primary key default gen_random_uuid()::text,
  issue_id text not null references issues(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table issue_comments enable row level security;

drop policy if exists "team members can access issue_comments" on issue_comments;
create policy "team members can access issue_comments"
on issue_comments for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, insert, update, delete on issue_comments to authenticated;

alter table issues add column if not exists comment_ack_by text[] not null default '{}';

-- Backfill: each issue's existing single note/fix value becomes its
-- first comment, authored by whoever reported the issue -- the old
-- single-field note never tracked who actually wrote it, so this is
-- the closest available attribution rather than a real author.
insert into issue_comments (id, issue_id, author, text, created_at)
select gen_random_uuid()::text, id, reported_by, remarks, created_at
from issues
where remarks is not null and trim(remarks) <> '';

insert into issue_comments (id, issue_id, author, text, created_at)
select gen_random_uuid()::text, id, reported_by, fix_note, created_at
from issues
where fix_note is not null and trim(fix_note) <> '';
