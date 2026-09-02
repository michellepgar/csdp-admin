-- phase4_backfill.sql — run once, immediately after
-- phase4_relational_templates_contacts.sql and BEFORE deploying the
-- app code that reads from these tables.

insert into email_templates (id, name, category, subject, body)
select t->>'id', t->>'name', t->>'category', t->>'subject', coalesce(t->>'body', '')
from app_state, jsonb_array_elements(coalesce(data->'emailTemplates', '[]'::jsonb)) as t
where id = 1;

insert into contact_groups (id, name)
select g->>'id', g->>'name'
from app_state, jsonb_array_elements(coalesce(data->'contactGroups', '[]'::jsonb)) as g
where id = 1;

insert into contact_rows (
  id, group_id, school, principal, principal_email, asst_principal,
  asst_principal_email, front_desk, front_desk_email, nurse_name, nurse_email, notes
)
select
  r->>'id',
  g->>'id',
  r->>'school',
  r->>'principal',
  r->>'principalEmail',
  r->>'asstPrincipal',
  r->>'asstPrincipalEmail',
  r->>'frontDesk',
  r->>'frontDeskEmail',
  r->>'nurseName',
  r->>'nurseEmail',
  r->>'notes'
from app_state,
  jsonb_array_elements(coalesce(data->'contactGroups', '[]'::jsonb)) as g,
  jsonb_array_elements(coalesce(g->'rows', '[]'::jsonb)) as r
where id = 1;

insert into settings (key, value)
select 'nurseLeader', coalesce(data->'nurseLeader', '{"name":"","email":""}'::jsonb)
from app_state where id = 1;

insert into settings (key, value)
select 'communicationEditor', jsonb_build_object('value', coalesce(data->>'communicationEditor', ''))
from app_state where id = 1;
