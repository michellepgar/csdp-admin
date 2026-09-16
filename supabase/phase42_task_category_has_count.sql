-- Apply after phase41 to project jqsqstjmfsqqrnoxpuvn.
-- Additive: turns COUNT_CATEGORIES (a hardcoded list of category
-- names in code) into a per-category toggle Michelle can flip herself
-- from the "Edit categories" panel, instead of needing a code change
-- every time a school needs a count column on a category that isn't
-- already on that list.
alter table task_categories
  add column if not exists has_count boolean not null default false;

-- Preserve today's behavior for existing data: these three categories
-- already showed a Count column (see the old COUNT_CATEGORIES
-- constant in lib/app-state.ts, removed by this same change).
update task_categories set has_count = true
where lower(btrim(name)) in ('encoding & uploading (consent & sdf)', 'initial', 'follow up');
