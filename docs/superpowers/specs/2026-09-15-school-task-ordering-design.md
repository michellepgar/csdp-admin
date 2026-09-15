# School Task Ordering Design

## Goal

Let team members reorder shared task categories, reorder task files within each category for one school, rename a task file, and rename a category without losing task associations.

## Data model

Add `tasks.sort_order integer not null` through a new Supabase migration. Backfill each task with a zero-based rank within `(school_id, category)`, ordered by its existing `created_at` and `id`; new tasks receive the next rank in their school/category.

`task_categories.sort_order` already exists and remains the authoritative global category order. Tasks store a category name rather than a category ID. Renaming a category must therefore update the category row and every matching task row in one operation sequence before revalidation.

## User interface

Inside **Edit categories**, each category has a drag handle and an edit control. Dragging changes the category order for every school. Renaming changes the category heading and its tasks across every school. Category removal retains its current behavior: existing task files remain under Other.

Each task row has a drag handle that reorders only files in the same category for the current school, plus an Edit control that replaces the file-name label with an input and Save/Cancel controls. Reordering, file-name edits, category editing, and category reordering remain available only when `canEdit` is true.

## Server behavior

Add server actions for category ordering, category renaming, task ordering, and task file-name updates. Each action validates the supplied identifiers against its current scope, updates the real Supabase data or cookie-backed demo state, and revalidates the relevant school page. Category-level changes also revalidate the shared layout so all school pages receive the new category list.

## Loading and tests

Fetch `tasks.sort_order` and order tasks by school/category rank before building `SchoolDataEntry`. Extend `Task` with `sortOrder`. Add focused tests for the pure ordering/rename helpers and the action payload contracts; manually verify drag behavior and inline edits after deployment.

## Constraints

- Preserve the current order of existing tasks during migration.
- Category ordering is global; task-file ordering is per school and per category.
- Category rename must migrate existing task `category` values.
- Do not modify unrelated school, task-status, signature, communications, or delete behavior.
