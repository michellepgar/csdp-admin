-- clear_contacts_and_distribution.sql — run once in Supabase's SQL
-- Editor, alongside/after the earlier clear_all_schools.sql, to
-- finish making Contacts and Distribution List a true blank slate.
-- Deleting a group cascades to its rows (contact_rows.group_id and
-- distribution_rows.group_id are both "on delete cascade" — see
-- supabase/phase4_relational_templates_contacts.sql and
-- supabase/phase7_relational_distribution.sql), so deleting from the
-- two group tables is enough.

delete from contact_groups where true;
delete from distribution_groups where true;
