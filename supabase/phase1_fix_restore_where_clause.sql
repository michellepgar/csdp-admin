-- phase1_fix_restore_where_clause.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn.
--
-- Supabase's Postgres projects have pg-safeupdate enabled by default,
-- which blocks any DELETE without a WHERE clause -- including inside
-- a security definer function, not just when run directly. Replaces
-- restore_vas_and_schools() with the same logic, just with a harmless
-- always-true WHERE clause on both deletes.

create or replace function restore_vas_and_schools(new_vas jsonb, new_schools jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
