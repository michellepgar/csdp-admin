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

create policy "team members can access vas"
on vas for all
using (
  auth.uid() is not null
  and exists (
    select 1 from vas v2
    where lower(v2.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1 from vas v2
    where lower(v2.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "team members can access schools"
on schools for all
using (
  auth.uid() is not null
  and exists (
    select 1 from vas
    where lower(vas.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1 from vas
    where lower(vas.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
