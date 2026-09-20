-- phase57_automatic_backups.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Where the nightly automatic backups are kept: a PRIVATE storage bucket
-- named 'backups'. The nightly job writes to it with the project's
-- service key (which bypasses these rules); the only thing granted here is
-- letting ADMINS in the app list and download the files from the Backup
-- page. Nobody else -- no other team member, no public link -- can see it.
-- (The admin test matches the app's isAdmin(): the admin flag, the owner
-- role, or Michelle.)

insert into storage.buckets (id, name, public, file_size_limit)
values ('backups', 'backups', false, 104857600)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "admins can read backups" on storage.objects;
create policy "admins can read backups"
on storage.objects for select
to authenticated
using (
  bucket_id = 'backups'
  and exists (
    select 1 from public.vas v
    where lower(v.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (coalesce(v.admin, false) or v.role = 'owner' or v.name = 'Michelle')
  )
);
