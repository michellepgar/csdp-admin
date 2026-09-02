-- phase4_relational_templates_contacts.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying
-- backfill script and BEFORE the app code that reads these tables is
-- deployed. Requires Phase 1 (is_team_member()) to already be applied.

create table email_templates (
  id text primary key,
  name text not null,
  category text,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table contact_groups (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table contact_rows (
  id text primary key,
  group_id text not null references contact_groups(id) on delete cascade,
  school text not null,
  principal text,
  principal_email text,
  asst_principal text,
  asst_principal_email text,
  front_desk text,
  front_desk_email text,
  nurse_name text,
  nurse_email text,
  notes text,
  created_at timestamptz not null default now()
);

-- Small scalar/object settings that don't warrant their own tables —
-- nurseLeader's value is {name, email}, communicationEditor's value is
-- {value: "<name>"} (wrapped, not a bare string, so every row's value
-- column is consistently a JSON object).
create table settings (
  key text primary key,
  value jsonb not null
);

alter table email_templates enable row level security;
alter table contact_groups enable row level security;
alter table contact_rows enable row level security;
alter table settings enable row level security;

grant select, insert, update, delete on email_templates to authenticated;
grant select, insert, update, delete on contact_groups to authenticated;
grant select, insert, update, delete on contact_rows to authenticated;
grant select, insert, update, delete on settings to authenticated;

create policy "team members can access email_templates"
on email_templates for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access contact_groups"
on contact_groups for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access contact_rows"
on contact_rows for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access settings"
on settings for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
