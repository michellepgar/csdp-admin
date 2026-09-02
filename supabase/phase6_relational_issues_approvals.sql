-- phase6_relational_issues_approvals.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying
-- backfill script and BEFORE the app code that reads these tables is
-- deployed. Requires Phase 1 (is_team_member()) to already be applied.

-- One wide table mirroring the Issue interface's shared shape across
-- all four issue types (software_issue, record_update, correction,
-- charting) -- each type only ever reads/writes its own relevant
-- columns, same approach already used in-memory.
create table issues (
  id text primary key,
  type text not null,
  reported_by text not null,
  status text not null,
  created_at timestamptz not null default now(),
  description text,
  category text,
  remarks text,
  student_name text,
  dob text,
  insurance_number text,
  school_year text,
  file_name text,
  page_number text,
  correcting_category text,
  correct_info text,
  correction_kind text,
  student_record_link text,
  needs_name_correction boolean,
  needs_dob_correction boolean,
  needs_insurance_correction boolean,
  needs_other_correction boolean,
  other_correction_detail text,
  question text,
  fixed_by text[] not null default '{}'
);

create table access_requests (
  id text primary key,
  record_kind text not null,
  school_id text references schools(id) on delete cascade,
  target_id text not null,
  label text not null,
  reason text not null,
  requested_by text not null,
  status text not null,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table issues enable row level security;
alter table access_requests enable row level security;

grant select, insert, update, delete on issues to authenticated;
grant select, insert, update, delete on access_requests to authenticated;

create policy "team members can access issues"
on issues for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access access_requests"
on access_requests for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
