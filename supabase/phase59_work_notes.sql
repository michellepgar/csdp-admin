-- phase59_work_notes.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn. Requires phase53_chat.sql (uses chat_my_name()).
--
-- Short "why I couldn't finish or continue this" notes a VA attaches to
-- their own work: a task or reminder in Overview's Currently Working On,
-- or an item in Next Shift Plan / Your Plan. Adding a note NEVER changes
-- the item itself -- the boss's tasks and priorities stay exactly as set;
-- the note is just an explanation shown next to it.
--
-- item_key says what the note is about:
--   t:<task_file_categories.id>   a school task
--   g:<general_tasks.id>          a General Task
--   p:<plan_items.id>             a priority or reminder on someone's plan
-- One note per person per item (writing again replaces it).
--
-- Everyone on the team can read notes; a person can only write, change or
-- remove THEIR OWN (va_name must be their own name).

create table if not exists work_notes (
  id text primary key default gen_random_uuid()::text,
  item_key text not null,
  va_name text not null,
  note text not null check (char_length(note) between 1 and 300),
  updated_at timestamptz not null default now(),
  unique (item_key, va_name)
);

alter table work_notes enable row level security;

drop policy if exists "team members can read work notes" on work_notes;
create policy "team members can read work notes"
on work_notes for select
using (auth.uid() is not null and is_team_member());

drop policy if exists "write only your own work notes" on work_notes;
create policy "write only your own work notes"
on work_notes for all
using (va_name = chat_my_name())
with check (va_name = chat_my_name());

grant select, insert, update, delete on work_notes to authenticated;
grant select on work_notes to service_role;
