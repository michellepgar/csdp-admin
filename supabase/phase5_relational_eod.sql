-- phase5_relational_eod.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying backfill script
-- and BEFORE the app code that reads this table is deployed. Requires
-- Phase 1 (is_team_member()) to already be applied.

create table eod_reports (
  id text primary key,
  author text not null,
  date date not null,
  time_in text,
  break_start text,
  break_end text,
  time_out text,
  total_hours text,
  tasks text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table eod_reports enable row level security;

grant select, insert, update, delete on eod_reports to authenticated;

create policy "team members can access eod_reports"
on eod_reports for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
