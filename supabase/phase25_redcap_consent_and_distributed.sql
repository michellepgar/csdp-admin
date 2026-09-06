-- phase25_redcap_consent_and_distributed.sql — run once in Supabase's
-- SQL Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE deploying the
-- app code that reads/writes redcap_tallies.consent or
-- redcap_distributed_forms. Run AFTER phase24_redcap_tallies.sql.

-- Per-student Positive/Negative consent answer -- tallied on the
-- report as "Positive Consent" under the same section as Distributed
-- below. Nullable (no default) since any rows entered before this
-- migration ran won't have an answer -- those just don't count toward
-- "Positive Consent" either way, same as any other field left unset.
alter table redcap_tallies add column if not exists consent text;

-- "Total # of Consent Forms Distributed" isn't derived from anything
-- entered per-student (see lib/app-state.ts's RedcapDistributedForms
-- comment) -- Michelle types this in directly per school/year, so it
-- gets its own tiny table instead of a column on redcap_tallies.
create table redcap_distributed_forms (
  school_id text not null references schools(id) on delete cascade,
  school_year text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, school_year)
);

alter table redcap_distributed_forms enable row level security;

grant select, insert, update, delete on redcap_distributed_forms to authenticated;

create policy "team members can access redcap_distributed_forms"
on redcap_distributed_forms for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
