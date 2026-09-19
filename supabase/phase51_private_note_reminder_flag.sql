-- Lets a private note be flagged as a reminder -- a quiet marker with no
-- effect on the Private Notes page itself, used later to pick from when
-- adding a reminder in End Today's Work (see app/(app)/overview/page.tsx's
-- upcoming reminder picker). Apply after Phase 3 (private_notes).
begin;

alter table private_notes add column if not exists is_reminder boolean not null default false;

commit;
