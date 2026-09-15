# School-specific task categories and checklist items

## Goal

Let a team member add a task category that belongs only to the school page they are viewing. The category name is also a yearly-checklist item for that same school. File names remain task files under the category and never become checklist items.

The existing shared task categories and shared yearly checklist stay unchanged.

## User experience

On a school page, **Edit categories** has two clearly separated additions:

- The existing **Add** control continues to create a shared category for every school.
- A new **Add for this school** control creates a category only for the current school. It is shown with a small “This school only” label in the editor and task list.

Creating a school-only category creates a matching school-only yearly-checklist item with the same name. It is displayed with the existing checklist items on that school’s page and cannot appear on another school’s checklist.

Renaming a school-only category renames its matching checklist item. Deleting it removes the matching checklist item; its existing files are retained and shown in **Other**, consistent with the current shared-category deletion behavior.

## Data model

Extend `task_categories` and `checklist_template` with nullable `school_id` columns referencing `schools(id)` with cascading deletion. `NULL` remains the existing global/shared meaning; a school ID means the row is private to that school.

The migration replaces the current global case-insensitive category-name uniqueness with two scopes:

- global names unique among global categories;
- names unique within each school’s school-only categories.

Each school-only category is linked to its matching checklist item by a stable category ID stored on the checklist row. Existing checklist items remain unlinked global items.

## Application flow

`fetchAppState` returns global categories plus categories for the viewed school, and returns global checklist items plus checklist items for the viewed school. The school page passes both scoped lists to its existing task and checklist cards.

Server actions validate the current user and school membership, then create, rename, reorder, or delete the category and linked checklist item together. Rename/delete updates are transactional so the two labels cannot drift apart. Existing tasks keep their saved category text if their category is deleted.

Demo mode mirrors the same relationships in its in-memory state.

## Visual refinements

- Destructive controls become a small red `×` with no colored button background, while retaining an accessible label/confirmation.
- Status badges use higher-contrast foreground/background pairs while preserving the existing warning, paused, success, and neutral meanings.

## Verification

Tests cover scoped category/checklist creation, rename, deletion, filtering to the active school, and the unchanged handling of existing task files. UI-source tests cover the discreet delete control and readable status color tokens. Run lint, the complete existing test suite, a production build, and a final deployment smoke check.
