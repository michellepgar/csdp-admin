# Shared-file multi-category task table

## Goal

Show each file name once in a compact Tasks table, even when the same file needs work in multiple categories. Each category assignment has its own VA signatures and status on the same table row.

## User experience

The Tasks page renders no empty category sections. A category becomes a visible table column only after at least one file has been assigned to it at that school; categories with no files do not appear in Tasks at all.

When adding a file, the user selects a primary category and can add one or more additional categories. The new file becomes one shared row. Each selected category receives an independent task cell.

Each cell shows the assigned VA(s) first, followed on the same line by the status, for example `Michelle · In Progress`. File name editing remains attached to the single shared file row.

## Data model

Add a `task_files` table containing the school, file name, sort order, and creation metadata. Add a `task_file_categories` table linking a file to one or more task categories, with per-category status, VA assignments, count, communication fields, and sort order.

Existing `tasks` rows are migrated one-for-one into a `task_files` record plus its linked `task_file_categories` record, preserving all existing visible data.

## Behavior

Adding a file with multiple categories creates one file record and one linked category task record per chosen category transactionally. Dragging reorders files within a category without duplicating the shared filename. Removing a category assignment removes only that category cell; removing the file removes every linked category task.

Existing category management remains the source of available categories. School-only categories remain scoped to their school and keep their matching checklist behavior.

The yearly checklist remains independent from whether a category has files. If a category is not needed for that school year, the team can check off its checklist item normally, so it counts as complete in the school percentage without requiring a file to be added.

## Verification

Add tests for one file with multiple categories, independent statuses/VAs, hidden unused columns, legacy task migration, category-only deletion, and file deletion. Run lint, the complete test suite, production build, migration application, and a deployment smoke check.
