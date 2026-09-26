-- phase78_feature_review.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn. Safe to run again.
--
-- My Workspace's Feature Review block (a kanban board for reviewing features
-- with a client):
--   * blocks may now be kind 'review' (the board's cards live in the block's
--     content, like every other block)
--   * card pictures go in a PRIVATE storage bucket, "workspace-files", in a
--     folder named after the signed-in user's id -- only that person can
--     upload, open or delete them (admins included). 10 MB per picture.

alter table blocks drop constraint if exists blocks_kind_check;
alter table blocks add constraint blocks_kind_check check (kind in ('table', 'note', 'reminder', 'review'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-files', 'workspace-files', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "workspace files: upload to own folder" on storage.objects;
create policy "workspace files: upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-files'
  and is_team_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "workspace files: read own folder" on storage.objects;
create policy "workspace files: read own folder"
on storage.objects for select
to authenticated
using (
  bucket_id = 'workspace-files'
  and is_team_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "workspace files: delete own folder" on storage.objects;
create policy "workspace files: delete own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-files'
  and is_team_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);
