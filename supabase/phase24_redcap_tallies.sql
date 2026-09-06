-- phase24_redcap_tallies.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE deploying the app code that
-- reads/writes redcap_tallies.
--
-- One row per student screened, not just running counters -- so a
-- mis-tap can be found and fixed/deleted later instead of the whole
-- count being a black box. The REDCap Report page computes every
-- total (including "Total # Students Sealed") from these rows live;
-- nothing is stored pre-aggregated. Kept across school years on
-- purpose (school_year is just a column, not a reset-on-rollover
-- table like tasks/checklist_progress) since Michelle needs to keep
-- entering both 2024-2025 and 2025-2026 data side by side.

create table redcap_tallies (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  school_year text not null,
  grade text not null,
  insurance text not null,
  dental_home_status text not null,
  referral text not null,
  race text not null,
  fluoride boolean not null default false,
  prophy boolean not null default false,
  sealed_1st_molar boolean not null default false,
  sealed_2nd_molar boolean not null default false,
  -- A student can have more than one dental need at once (e.g. both
  -- Caries and Urgent) -- kept as an array rather than one row per
  -- need, same reasoning as va_assigned on tasks (see phase2 migration).
  needs text[] not null default '{}',
  entered_by text,
  created_at timestamptz not null default now()
);

create index redcap_tallies_school_year_idx on redcap_tallies(school_id, school_year);

alter table redcap_tallies enable row level security;

grant select, insert, update, delete on redcap_tallies to authenticated;

-- Same team-member-wide policy every other table uses (see e.g.
-- phase8_school_contacts_and_school_fields.sql) -- the REDCap Report
-- page's nav link is hidden for everyone but Michelle at the app
-- layer (app/(app)/layout.tsx), not at the database layer. Tighten
-- this later if that ever needs to be a hard requirement rather than
-- just "nobody else has a reason to go looking."
create policy "team members can access redcap_tallies"
on redcap_tallies for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
