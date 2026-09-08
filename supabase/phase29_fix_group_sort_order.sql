-- Phase 29: contact_groups/distribution_groups get their sort_order
-- whenever a NEW group is first created (max sort_order + 1), so
-- their on-screen order ended up reflecting creation order, not the
-- intended Pre-K / Elementary / Middle / High School sequence
-- (SCHOOL_GROUPS in lib/app-state.ts). This normalizes existing rows
-- to that order by exact name match; a group whose name doesn't match
-- any of the four is left untouched.
update contact_groups set sort_order = 0 where name = 'Pre-K';
update contact_groups set sort_order = 1 where name = 'Elementary School';
update contact_groups set sort_order = 2 where name = 'Middle School';
update contact_groups set sort_order = 3 where name = 'High School';

update distribution_groups set sort_order = 0 where name = 'Pre-K';
update distribution_groups set sort_order = 1 where name = 'Elementary School';
update distribution_groups set sort_order = 2 where name = 'Middle School';
update distribution_groups set sort_order = 3 where name = 'High School';
