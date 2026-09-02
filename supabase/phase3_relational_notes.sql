-- phase3_relational_notes.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying backfill script
-- and BEFORE the app code that reads these tables is deployed.
-- Requires Phase 1 (is_team_member()) to already be applied.

create table suggestions (
  id text primary key,
  text text not null,
  author text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table general_notes (
  id text primary key,
  text text not null,
  author text not null,
  urgency text,
  ack_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table private_notes (
  id text primary key,
  text text not null,
  author text not null,
  shared_with text[] not null default '{}',
  ack_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table suggestions enable row level security;
alter table general_notes enable row level security;
alter table private_notes enable row level security;

grant select, insert, update, delete on suggestions to authenticated;
grant select, insert, update, delete on general_notes to authenticated;
grant select, insert, update, delete on private_notes to authenticated;

create policy "team members can access suggestions"
on suggestions for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access general_notes"
on general_notes for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

-- private_notes has no row-level "only the author/shared-with can see
-- this" restriction at the database level -- same as every other table
-- in this app, visibility is enforced in the app layer
-- (visiblePrivateNotes() in lib/app-state.ts), not by RLS. This matches
-- the existing security model: RLS only gates "are you on the team at
-- all", never per-record business rules.
create policy "team members can access private_notes"
on private_notes for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
