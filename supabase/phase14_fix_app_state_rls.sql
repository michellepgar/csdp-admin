-- phase14_fix_app_state_rls.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Root cause of a newly-added teammate's "Couldn't load the app -- try
-- reloading.": the debug page at /debug-state showed her auth email
-- correctly matching a row in `vas` (so is_team_member() is fine), but
-- the app_state single-row query failed with PGRST116 ("Cannot coerce
-- the result to a single JSON object") -- Postgres returned zero rows
-- for her, even though the row obviously exists (Michelle and every
-- other existing VA can see it).
--
-- Every other table in this app (vas, schools, tasks, issues, etc.)
-- was moved onto the shared is_team_member() policy back in
-- phase1_relational_team_schools.sql / phase1_fix_rls_recursion.sql.
-- app_state itself predates this repo (it's the original single-file
-- app's one JSON-blob table, set up directly in the Supabase dashboard
-- before any of these phase*.sql files existed) and was never brought
-- along -- it's almost certainly still running whatever ad-hoc policy
-- (or a hardcoded list of the ORIGINAL team's emails) it started with,
-- which a newly-added VA row was never going to match. This replaces
-- whatever that old policy is with the same is_team_member() policy
-- everything else uses, and adds the base table grant every fresh (or
-- in this case previously-unmanaged) table needs for "authenticated"
-- separately from RLS -- see phase13's comment for why that's a
-- distinct check RLS can't substitute for.

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'app_state'
  loop
    execute format('drop policy %I on public.app_state', pol.policyname);
  end loop;
end $$;

alter table app_state enable row level security;

create policy "team members can access app_state"
on app_state for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, update on app_state to authenticated;
