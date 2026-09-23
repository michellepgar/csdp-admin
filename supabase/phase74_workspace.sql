-- phase74_workspace.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn.
--
-- My Workspace for everyone: private workbooks -> sheets -> blocks.
-- Every table is owner-only at the DATABASE level via my_workspace_owns()
-- (created in phase73): a row is readable/writable only when the signed-in
-- user's email matches a vas row whose name equals the row's `owner`.
-- Also retires the Document Review table from phase73, which is removed.

drop table if exists document_extractions;

create table workbooks (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  title text not null default 'Untitled workbook',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sheets (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  owner text not null,
  name text not null default 'Sheet',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references sheets(id) on delete cascade,
  owner text not null,
  kind text not null check (kind in ('table', 'note', 'reminder')),
  x integer not null default 0,
  y integer not null default 0,
  w integer not null default 320,
  h integer not null default 200,
  z integer not null default 0,
  content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sheets_workbook_idx on sheets (workbook_id);
create index blocks_sheet_idx on blocks (sheet_id);

alter table workbooks enable row level security;
alter table sheets enable row level security;
alter table blocks enable row level security;

grant select, insert, update, delete on workbooks to authenticated;
grant select, insert, update, delete on sheets to authenticated;
grant select, insert, update, delete on blocks to authenticated;

create policy "owner can access their own workbooks"
on workbooks for all
using (auth.uid() is not null and my_workspace_owns(owner))
with check (auth.uid() is not null and my_workspace_owns(owner));

create policy "owner can access their own sheets"
on sheets for all
using (auth.uid() is not null and my_workspace_owns(owner))
with check (auth.uid() is not null and my_workspace_owns(owner));

create policy "owner can access their own blocks"
on blocks for all
using (auth.uid() is not null and my_workspace_owns(owner))
with check (auth.uid() is not null and my_workspace_owns(owner));
