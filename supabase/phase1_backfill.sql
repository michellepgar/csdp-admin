-- phase1_backfill.sql — run once, immediately after
-- phase1_relational_team_schools.sql and BEFORE deploying the app code
-- that reads from these tables. Copies the current app_state blob's
-- vas/schools arrays into the new tables so no existing data is lost.

insert into vas (id, name, email, admin, role, color)
select
  va->>'id',
  va->>'name',
  va->>'email',
  (va->>'admin')::boolean,
  va->>'role',
  va->>'color'
from app_state, jsonb_array_elements(coalesce(data->'vas', '[]'::jsonb)) as va
where id = 1;

insert into schools (id, name)
select
  s->>'id',
  s->>'name'
from app_state, jsonb_array_elements(coalesce(data->'schools', '[]'::jsonb)) as s
where id = 1;
