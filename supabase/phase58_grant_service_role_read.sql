-- phase58_grant_service_role_read.sql — run once in Supabase's SQL Editor
-- for project jqsqstjmfsqqrnoxpuvn.
--
-- The automatic nightly backup (lib/automatic-backup.ts) reads every table
-- with the project's service_role key. That role bypasses row-level
-- security, but it still needs the ordinary permission to SELECT from each
-- table -- and on this project it was never granted ("permission denied for
-- table vas", error 42501). Read-only is all the backup needs, so read-only
-- is all this grants: the backup can read your tables but can't change them.
--
-- The last line makes tables created in future phases readable too, so the
-- backup doesn't silently lose them.

grant usage on schema public to service_role;
grant select on all tables in schema public to service_role;
alter default privileges in schema public grant select on tables to service_role;
