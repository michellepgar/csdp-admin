-- phase7_backfill.sql — run once, immediately after
-- phase7_relational_distribution.sql and BEFORE deploying the app code
-- that reads from these tables. DistributionGroup/DistributionRow have
-- no createdAt field at all, so sort_order is populated from each
-- item's original position in the blob's arrays (ordinality), not a
-- timestamp -- avoiding the exact reordering bug Phase 4 shipped and
-- had to hotfix.

insert into distribution_groups (id, name, sort_order)
select g.elem->>'id', g.elem->>'name', g.idx - 1
from app_state, jsonb_array_elements(coalesce(data->'distributionGroups', '[]'::jsonb)) with ordinality as g(elem, idx)
where id = 1;

insert into distribution_rows (id, group_id, school, enrolled, contact_person, remarks, breakdown, sort_order)
select
  r.elem->>'id',
  g->>'id',
  r.elem->>'school',
  r.elem->>'enrolled',
  r.elem->>'contactPerson',
  r.elem->>'remarks',
  coalesce(r.elem->'breakdown', '{}'::jsonb),
  r.idx - 1
from app_state,
  jsonb_array_elements(coalesce(data->'distributionGroups', '[]'::jsonb)) as g,
  jsonb_array_elements(coalesce(g->'rows', '[]'::jsonb)) with ordinality as r(elem, idx)
where id = 1;
