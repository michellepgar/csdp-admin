-- phase65_suggestion_attachments.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn. Requires phase53_chat.sql (uses is_team_member()).
--
-- Suggestions can now carry a long description and any number of screenshots
-- or files:
--   * suggestions.details       the long description (up to 5,000 characters)
--   * suggestion_attachments    one row per attached file
--   * a PRIVATE storage bucket 'suggestion-attachments' (25 MB per file)
-- Files stay with the suggestion until it is deleted (there is no expiry).
-- Everyone on the team can see and open them; nobody outside the team can.

alter table suggestions add column if not exists details text;
alter table suggestions drop constraint if exists suggestions_details_length;
alter table suggestions
  add constraint suggestions_details_length check (details is null or char_length(details) <= 5000);

create table if not exists suggestion_attachments (
  id text primary key default gen_random_uuid()::text,
  suggestion_id text not null references suggestions(id) on delete cascade,
  path text not null,
  name text not null,
  type text not null,
  size bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suggestion_attachments_suggestion_idx on suggestion_attachments (suggestion_id);

alter table suggestion_attachments enable row level security;

drop policy if exists "team members can use suggestion attachments" on suggestion_attachments;
create policy "team members can use suggestion attachments"
on suggestion_attachments for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, insert, update, delete on suggestion_attachments to authenticated;
grant select on suggestion_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'suggestion-attachments',
  'suggestion-attachments',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload: a team member, into a folder named after their own user id.
drop policy if exists "suggestion attachments: upload to own folder" on storage.objects;
create policy "suggestion attachments: upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'suggestion-attachments'
  and is_team_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Read: any team member.
drop policy if exists "suggestion attachments: team can read" on storage.objects;
create policy "suggestion attachments: team can read"
on storage.objects for select
to authenticated
using (bucket_id = 'suggestion-attachments' and is_team_member());

-- Delete: a team member (the app only does this when the suggestion is deleted
-- by its author or Michelle, or to clean up a failed upload).
drop policy if exists "suggestion attachments: team can delete" on storage.objects;
create policy "suggestion attachments: team can delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'suggestion-attachments' and is_team_member());
