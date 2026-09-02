-- phase3_backfill.sql — run once, immediately after
-- phase3_relational_notes.sql and BEFORE deploying the app code that
-- reads from these tables.

insert into suggestions (id, text, author, status, created_at)
select
  s->>'id',
  s->>'text',
  s->>'author',
  coalesce(s->>'status', 'Requested'),
  coalesce((s->>'createdAt')::timestamptz, now())
from app_state, jsonb_array_elements(coalesce(data->'suggestions', '[]'::jsonb)) as s
where id = 1;

insert into general_notes (id, text, author, urgency, ack_by, created_at)
select
  n->>'id',
  n->>'text',
  n->>'author',
  nullif(n->>'urgency', ''),
  coalesce((select array_agg(x) from jsonb_array_elements_text(n->'ackBy') as x), '{}'),
  coalesce((n->>'createdAt')::timestamptz, now())
from app_state, jsonb_array_elements(coalesce(data->'generalNotes', '[]'::jsonb)) as n
where id = 1;

insert into private_notes (id, text, author, shared_with, ack_by, created_at)
select
  n->>'id',
  n->>'text',
  n->>'author',
  coalesce((select array_agg(x) from jsonb_array_elements_text(n->'sharedWith') as x), '{}'),
  coalesce((select array_agg(x) from jsonb_array_elements_text(n->'ackBy') as x), '{}'),
  coalesce((n->>'createdAt')::timestamptz, now())
from app_state, jsonb_array_elements(coalesce(data->'privateNotes', '[]'::jsonb)) as n
where id = 1;
