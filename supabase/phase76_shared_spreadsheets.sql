-- phase76_shared_spreadsheets.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn. Safe to run again.
--
-- The shared Spreadsheets page (under Resources). Every signed-in team
-- member can open, edit, add and delete every spreadsheet.
--
--   spreadsheets               one row per spreadsheet (title, tags)
--   spreadsheet_sheets         its tabs: name, order, and a version number
--   spreadsheet_sheet_content  each tab's grid (kept apart so live updates
--                              only ever send the small tab row, never the
--                              whole grid)
--
-- Edits are saved as small operations applied to the latest copy; each save
-- raises the version, and a trigger copies it onto the tab row so everyone
-- with the spreadsheet open is told to pull in the change.

create table if not exists spreadsheets (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled spreadsheet',
  tags text[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists spreadsheet_sheets (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id uuid not null references spreadsheets(id) on delete cascade,
  name text not null default 'Sheet',
  sort_order integer not null default 0,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists spreadsheet_sheet_content (
  sheet_id uuid primary key references spreadsheet_sheets(id) on delete cascade,
  content jsonb not null default '{}',
  version bigint not null default 0,
  updated_by text
);

create index if not exists spreadsheet_sheets_spreadsheet_idx on spreadsheet_sheets (spreadsheet_id);

-- A saved grid bumps its tab's version (the live-update signal) and the
-- spreadsheet's "last edited" time and person.
create or replace function spreadsheet_content_saved() returns trigger
language plpgsql
set search_path = public
as $$
begin
  update spreadsheet_sheets
     set version = new.version, updated_at = now(), updated_by = new.updated_by
   where id = new.sheet_id;
  update spreadsheets
     set updated_at = now(), updated_by = new.updated_by
   where id = (select spreadsheet_id from spreadsheet_sheets where id = new.sheet_id);
  return new;
end $$;

drop trigger if exists spreadsheet_content_saved on spreadsheet_sheet_content;
create trigger spreadsheet_content_saved
after update on spreadsheet_sheet_content
for each row execute function spreadsheet_content_saved();

alter table spreadsheets enable row level security;
alter table spreadsheet_sheets enable row level security;
alter table spreadsheet_sheet_content enable row level security;

grant select, insert, update, delete on spreadsheets to authenticated;
grant select, insert, update, delete on spreadsheet_sheets to authenticated;
grant select, insert, update, delete on spreadsheet_sheet_content to authenticated;

drop policy if exists "team members can use spreadsheets" on spreadsheets;
create policy "team members can use spreadsheets"
on spreadsheets for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

drop policy if exists "team members can use spreadsheet sheets" on spreadsheet_sheets;
create policy "team members can use spreadsheet sheets"
on spreadsheet_sheets for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

drop policy if exists "team members can use spreadsheet content" on spreadsheet_sheet_content;
create policy "team members can use spreadsheet content"
on spreadsheet_sheet_content for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

-- Live updates: tab rows (name, order, version) are broadcast to everyone
-- with the spreadsheet open, still filtered by the row-level security above.
do $$
begin
  alter publication supabase_realtime add table spreadsheet_sheets;
exception when duplicate_object then null;
end $$;

-- This project only allows private realtime channels (see phase36). Each
-- open spreadsheet uses a private channel named 'spreadsheet:<id>' for the
-- live updates above and for showing who else is on the page.
drop policy if exists "team members can receive spreadsheet channels" on realtime.messages;
drop policy if exists "team members can send spreadsheet presence" on realtime.messages;

create policy "team members can receive spreadsheet channels"
on realtime.messages for select
to authenticated
using (
  realtime.topic() like 'spreadsheet:%'
  and public.is_team_member()
);

create policy "team members can send spreadsheet presence"
on realtime.messages for insert
to authenticated
with check (
  realtime.topic() like 'spreadsheet:%'
  and realtime.messages.extension in ('presence')
  and public.is_team_member()
);
