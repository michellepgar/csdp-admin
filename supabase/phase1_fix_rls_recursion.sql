-- phase1_fix_rls_recursion.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn. Fixes "infinite recursion detected in
-- policy for relation 'vas'" (Postgres error 42P17).
--
-- The vas/schools policies checked "does a row in vas match my email?"
-- directly inside vas's own policy — Postgres refuses this because
-- checking that row would itself re-trigger the same policy, and so on.
-- The fix is a small helper function marked `security definer`, which
-- runs with the function owner's privileges and so bypasses vas's RLS
-- for this one specific internal lookup, breaking the loop.

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

drop policy "team members can access vas" on vas;
drop policy "team members can access schools" on schools;

create policy "team members can access vas"
on vas for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access schools"
on schools for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
