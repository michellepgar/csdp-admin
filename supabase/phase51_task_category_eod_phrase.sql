-- Optional per-category wording used to build EOD-ready lines on
-- Overview's Currently Working On list view (e.g. "Encode/Update Info,
-- Upload" for a "Before Visit" category). Null/blank falls back to the
-- category's own name.
alter table task_categories
  add column if not exists eod_phrase text;
