-- Phase 11: rename the "Recheck" task category to "Follow up".
-- Run this once in the Supabase SQL Editor, then let Claude know
-- ("done") so the matching app code (which matches on this exact
-- category name) can be deployed.

update task_categories set name = 'Follow up' where name = 'Recheck';
update tasks set category = 'Follow up' where category = 'Recheck';
