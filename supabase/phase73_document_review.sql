-- phase73_document_review.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- "My Workspace": a private table for Michelle's own Document Review
-- tool. Private Notes' own RLS (phase3_relational_notes.sql) only
-- checks "are you on the team," leaving row-level privacy entirely to
-- the app's own query code -- not strict enough for data that can
-- include names, DOB, insurance numbers and medical details. This
-- table gets a real per-owner policy instead: a row is only
-- visible/writable when the signed-in user's email matches a vas row
-- whose name equals this row's own `owner`. (Today only Michelle's
-- email can even reach this table at all -- see
-- lib/my-workspace-access.ts -- but the DB-level rule is written to
-- already be correct if this ever opens up to other VAs later, each
-- seeing only their own rows.)

create table document_extractions (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  document_name text not null,
  document_type text not null default 'Other',
  school text,
  summary text not null default '',
  fields jsonb not null default '[]',
  flags jsonb not null default '[]',
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'encoded', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  encoded_at timestamptz
);

alter table document_extractions enable row level security;
grant select, insert, update, delete on document_extractions to authenticated;

create or replace function my_workspace_owns(row_owner text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from vas
    where lower(vas.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and vas.name = row_owner
  );
$$;

create policy "owner can access their own document_extractions"
on document_extractions for all
using (auth.uid() is not null and my_workspace_owns(owner))
with check (auth.uid() is not null and my_workspace_owns(owner));
