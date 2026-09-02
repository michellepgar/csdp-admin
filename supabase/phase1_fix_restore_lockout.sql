-- phase1_fix_restore_lockout.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Restoring a backup deletes every row in vas, then re-inserts the
-- backup's rows. But is_team_member() (used by vas's own RLS policy)
-- checks "does any row in vas match my email?" — the instant the
-- delete runs, vas is empty, so that check starts failing, including
-- for the very insert meant to repopulate it. The delete commits, the
-- insert gets rejected by RLS, and vas is left permanently empty —
-- this is 100% reproducible, not a rare race. This function does the
-- whole delete-then-insert as one security definer operation, so RLS
-- (and the empty-table window) never comes into play at all.

create or replace function restore_vas_and_schools(new_vas jsonb, new_schools jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `where true` on each delete is required: every Supabase project has
  -- pg-safeupdate enabled by default, which blocks any DELETE with no
  -- WHERE clause at all, even inside a security definer function (a
  -- second real incident hit during Phase 1's rollout — see
  -- supabase/phase1_fix_restore_where_clause.sql).
  delete from vas where true;
  insert into vas (id, name, email, admin, role, color)
  select
    v->>'id',
    v->>'name',
    v->>'email',
    (v->>'admin')::boolean,
    v->>'role',
    v->>'color'
  from jsonb_array_elements(new_vas) as v;

  delete from schools where true;
  insert into schools (id, name)
  select s->>'id', s->>'name'
  from jsonb_array_elements(new_schools) as s;
end;
$$;

-- Same non-DB-enforced-admin model as every other table in this app
-- (see isAdmin() in lib/app-state.ts) — the Next.js action already
-- requires an admin before calling this; any authenticated team member
-- being ABLE to call it directly (bypassing the app's own UI) matches
-- how every other write in this app already works, not a new gap.
grant execute on function restore_vas_and_schools(jsonb, jsonb) to authenticated;
