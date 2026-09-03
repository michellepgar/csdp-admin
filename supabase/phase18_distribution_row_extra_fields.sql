-- phase18_distribution_row_extra_fields.sql — run once in Supabase's
-- SQL Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE deploying the
-- app code that reads/writes these columns.
--
-- Michelle asked for the Distribution List table to match the
-- original HTML app's fuller column set: a Distributed yes/no flag,
-- a classroom count per type (Regular/Launch/CRR -- a plain count,
-- separate from the existing classroom-type x language FORMS
-- breakdown already stored in distribution_rows.breakdown), and a
-- single Number of Consent Packets count. None of these existed in
-- the simplified rewrite.

alter table distribution_rows add column if not exists distributed boolean not null default false;
alter table distribution_rows add column if not exists classroom_regular text;
alter table distribution_rows add column if not exists classroom_launch text;
alter table distribution_rows add column if not exists classroom_crr text;
alter table distribution_rows add column if not exists consent_packets text;
