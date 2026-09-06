-- phase26_redcap_distributed_forms_per_grade.sql — run once in
-- Supabase's SQL Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE
-- deploying the app code that reads/writes redcap_distributed_forms
-- with a grade. Run AFTER phase25_redcap_consent_and_distributed.sql.
--
-- Distributed forms turned out to need entering per grade level, not
-- one total per school/year -- recreating the table with grade in the
-- primary key rather than altering it in place, since this feature is
-- brand new and whatever single total-only number was entered under
-- the old shape no longer matches how it needs to be recorded (it has
-- to be split out by grade now anyway).
drop table if exists redcap_distributed_forms;

create table redcap_distributed_forms (
  school_id text not null references schools(id) on delete cascade,
  school_year text not null,
  grade text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, school_year, grade)
);

alter table redcap_distributed_forms enable row level security;

grant select, insert, update, delete on redcap_distributed_forms to authenticated;

create policy "team members can access redcap_distributed_forms"
on redcap_distributed_forms for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
