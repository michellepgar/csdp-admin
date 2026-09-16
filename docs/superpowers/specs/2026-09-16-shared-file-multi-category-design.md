# Shared-file multi-category task table

## Goal

Show one file name once even when that file has work in more than one category. Each category assignment keeps its own VA(s), status, count, and communication details, while the existing school-page layout and the collapsible Yearly Checklist stay familiar.

## Category model

Task categories are one shared list available to every school. There is no longer an "only for this school" category option.

When adding a file at a school, the existing add-task flow begins with the category dropdown. The user chooses one category, may add more categories for the same file, and then enters the file name and the usual task details. A category only becomes visible in that school's Tasks table after at least one file uses it. Categories without files do not render as empty sections or columns.

Existing school-only categories will be promoted into the shared list without losing their tasks or checklist links. If a shared category with the same normalized name already exists, the migration will merge the scoped category into it rather than create a duplicate.

## Tasks table

The school page shows one compact Tasks table instead of separate category sections:

- one row per file;
- one column for each category currently used by a file at that school;
- a category cell contains its own VA(s) followed by its status on the same line, for example `Michelle · In Progress`;
- one file can have one or multiple category cells;
- file-name editing stays on the shared file row;
- removing a category assignment removes only that category cell; removing a file removes all of its assignments;
- drag-and-drop reorders the shared file rows while preserving the existing discreet drag/edit/delete controls.

## Data and migration

Introduce `task_files` for the shared school/file identity and `task_file_categories` for each category-specific task assignment. The assignment row contains the fields currently stored on `tasks`, including VA, status, count, communication status, communication VA, and ordering metadata.

The database migration will convert each legacy `tasks` record into one file record plus one linked category assignment, retaining visible values and timestamps. Records that refer to the same school and normalized file name will be grouped into one file with multiple assignments. The migration is idempotent, validates duplicate category links, and leaves the old data available until conversion is verified before it is retired.

## Yearly Checklist

The Yearly Checklist remains in its current right-side collapsible panel. It is independent from whether a category has files.

Every checklist row has a small, discreet `×` action. Choosing it marks that item **Not needed** for that school: its label is struck through, the decision remains visible, and it is excluded from that school's completion-percentage denominator. An Undo action restores it. Normal completed items continue to count as completed, and a relevant item can still be completed even when the school has no matching file.

The implementation records this per school/checklist item as an explicit not-needed state, rather than changing the shared checklist template. Exports and overview calculations use the same applicable-item rule.

## Safety and verification

- Preserve all legacy tasks, category labels, category checklist links, assignments, statuses, counts, and sort order during migration.
- Add tests for multi-category files, independent category cells, category-first adding, unused-category hiding, school-category promotion/merge, checklist not-needed percentage behavior, undo, and deletion behavior.
- Run lint, the complete test suite, a production build, migration application against Supabase, and a deployed smoke check for a one-category file, multi-category file, and a not-needed checklist item.
