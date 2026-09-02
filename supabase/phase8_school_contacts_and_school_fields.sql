-- phase8_school_contacts_and_school_fields.sql — run once in
-- Supabase's SQL Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE
-- deploying the app code that reads/writes school_contacts or
-- schools.website/hours.

alter table schools add column if not exists website text;
alter table schools add column if not exists hours text;

create table school_contacts (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  position text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table school_contacts enable row level security;

grant select, insert, update, delete on school_contacts to authenticated;

create policy "team members can access school_contacts"
on school_contacts for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
