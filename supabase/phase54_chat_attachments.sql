-- phase54_chat_attachments.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn. Requires phase53_chat.sql first.
--
-- Photos and documents in chat (Team room + private chats):
--   * files live in a PRIVATE storage bucket, 10 MB max each, only photo/
--     PDF/Word/Excel/CSV/text types
--   * a file can be opened only by someone who could read the message it
--     belongs to (so a private chat's files stay private, admins included)
--   * files are deleted after 30 days -- people download what they want to
--     keep. chat_expire_attachments() marks them expired and hands back the
--     paths so the app can remove the actual files.

alter table chat_messages add column if not exists attachment_path text;
alter table chat_messages add column if not exists attachment_name text;
alter table chat_messages add column if not exists attachment_type text;
alter table chat_messages add column if not exists attachment_size bigint;
alter table chat_messages add column if not exists attachment_expired boolean not null default false;

-- A message may now be attachment-only (empty text).
alter table chat_messages drop constraint if exists chat_messages_body_check;
alter table chat_messages
  add constraint chat_messages_body_check
  check (char_length(body) <= 2000 and (char_length(body) >= 1 or attachment_path is not null));

create index if not exists chat_messages_attachment_idx on chat_messages (attachment_path) where attachment_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload: a team member, into a folder named after their own user id.
drop policy if exists "chat attachments: upload to own folder" on storage.objects;
create policy "chat attachments: upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and is_team_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Read: your own uploads, or a file attached to a message in a room you can read.
drop policy if exists "chat attachments: read in your rooms" on storage.objects;
create policy "chat attachments: read in your rooms"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and is_team_member()
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from chat_messages m
      where m.attachment_path = storage.objects.name
        and chat_can_access(m.room)
    )
  )
);

-- Delete: only files whose message is marked expired, or your own upload
-- that never got attached to a message (a failed send).
drop policy if exists "chat attachments: delete expired or orphaned" on storage.objects;
create policy "chat attachments: delete expired or orphaned"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and is_team_member()
  and (
    exists (
      select 1 from chat_messages m
      where m.attachment_path = storage.objects.name
        and m.attachment_expired
    )
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and not exists (select 1 from chat_messages m where m.attachment_path = storage.objects.name)
    )
  )
);

-- Marks attachments older than p_days as expired and returns their file
-- paths (the app then deletes the files themselves).
create or replace function chat_expire_attachments(p_days integer default 30)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not is_team_member() then
    raise exception 'Not authorized';
  end if;
  return query
    update chat_messages
       set attachment_expired = true
     where attachment_path is not null
       and not attachment_expired
       and created_at < now() - make_interval(days => p_days)
    returning attachment_path;
end;
$$;

revoke all on function chat_expire_attachments(integer) from public;
grant execute on function chat_expire_attachments(integer) to authenticated;
