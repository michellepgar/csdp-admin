-- phase1_relational_team_schools.sql — run once in Supabase's SQL Editor
-- for project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying backfill
-- script and BEFORE the app code that reads these tables is deployed.
--
-- Creates the vas and schools tables that Team & Schools now live in,
-- instead of the app_state blob's vas/schools arrays.

create table vas (
  id text primary key,
  name text not null,
  email text,
  admin boolean,
  role text,
  color text
);

-- Prevents two VAs from ever having the same name (case-insensitive) —
-- the app-level duplicate check in addVa() is a nice UX shortcut, but
-- this is the actual backstop against a race between two concurrent
-- "Add VA" submissions.
create unique index vas_name_lower_unique on vas (lower(name));

create table schools (
  id text primary key,
  name text not null
);

alter table vas enable row level security;
alter table schools enable row level security;

-- The Next.js app authenticates every request via real Supabase Auth
-- (email/password) — unlike the original HTML app's shared-password
-- system, there's no anon-role fallback needed here. Any signed-in user
-- whose email matches a row in vas can read/write both tables; the app
-- itself (not the database) is what decides which actions are
-- admin-only, same as before (see isAdmin() in lib/app-state.ts).
grant select, insert, update, delete on vas to authenticated;
grant select, insert, update, delete on schools to authenticated;

-- A table's RLS policy can't query that same table for its own check —
-- Postgres refuses this outright ("infinite recursion detected in
-- policy for relation 'vas'", error 42P17), even through an alias,
-- because checking a candidate row would itself re-trigger the same
-- policy. security definer bypasses vas's RLS for just this one
-- internal lookup, breaking that loop. (Found the hard way during
-- Phase 1's rollout — see git history around
-- supabase/phase1_fix_rls_recursion.sql for the incident.)
create or replace function is_team_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from vas
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create policy "team members can access vas"
on vas for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access schools"
on schools for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

-- Restoring a backup replaces vas/schools wholesale (delete everything,
-- insert the backup's rows). A plain delete-then-insert from the app
-- breaks this: is_team_member() checks "does any row in vas match my
-- email?", so the instant the delete empties vas, that check starts
-- failing — including for the very insert meant to repopulate it. The
-- delete commits, the insert gets rejected by RLS, and vas is left
-- permanently empty (this happened for real during Phase 1's rollout —
-- see git history around supabase/phase1_fix_restore_lockout.sql).
-- Doing both steps inside one security definer function sidesteps that
-- empty-table window entirely.
create or replace function restore_vas_and_schools(new_vas jsonb, new_schools jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from vas;
  insert into vas (id, name, email, admin, role, color)
  select
    v->>'id',
    v->>'name',
    v->>'email',
    (v->>'admin')::boolean,
    v->>'role',
    v->>'color'
  from jsonb_array_elements(new_vas) as v;

  delete from schools;
  insert into schools (id, name)
  select s->>'id', s->>'name'
  from jsonb_array_elements(new_schools) as s;
end;
$$;

grant execute on function restore_vas_and_schools(jsonb, jsonb) to authenticated;
