-- phase5_backfill.sql — run once, immediately after
-- phase5_relational_eod.sql and BEFORE deploying the app code that
-- reads from this table. Preserves each report's own createdAt from
-- the blob (a real historical timestamp, not invented at backfill
-- time), so ordering by created_at stays correct after this.

insert into eod_reports (id, author, date, time_in, break_start, break_end, time_out, total_hours, tasks, created_at)
select
  r->>'id',
  r->>'author',
  (r->>'date')::date,
  r->>'timeIn',
  r->>'breakStart',
  r->>'breakEnd',
  r->>'timeOut',
  r->>'totalHours',
  coalesce((select array_agg(x) from jsonb_array_elements_text(r->'tasks') as x), '{}'),
  coalesce((r->>'createdAt')::timestamptz, now())
from app_state, jsonb_array_elements(coalesce(data->'eodReports', '[]'::jsonb)) as r
where id = 1;
