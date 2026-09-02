-- phase9_other_contacts.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE deploying the app code that
-- reads/writes other_contacts.
--
-- A flat list of contacts not tied to any school (e.g. "District
-- Office", "IT Support", a vendor) -- unlike contact_rows, which
-- always represents a specific school's Principal/Asst.
-- Principal/Front Desk/Nurse. Not grouped like contact_groups/
-- contact_rows since grouping by school-type (Pre-K/Elementary/etc.)
-- doesn't apply here.

create table other_contacts (
  id text primary key,
  name text not null,
  organization text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table other_contacts enable row level security;

grant select, insert, update, delete on other_contacts to authenticated;

create policy "team members can access other_contacts"
on other_contacts for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
