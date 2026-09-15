# School-specific categories and checklist items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add school-only task categories that create matching checklist items, while making delete controls quieter and status text more readable.

**Architecture:** Global rows keep `school_id = NULL`; school-only category and checklist rows carry the current school ID, and a checklist row stores its owning category ID. The school page filters the existing app state into its global-plus-current-school data before rendering. A database RPC performs school-only create, rename, and delete operations atomically, while shared category actions retain their existing behavior.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Supabase/Postgres, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-school-specific-categories-design.md`

## Global Constraints

- Preserve every existing shared category and shared checklist item unchanged.
- File names remain task files; only a school-only category name becomes a checklist item.
- A school-only category and its checklist item must always have the same name.
- Existing task files are retained when their category is deleted and appear in **Other**.
- Do not modify or stage `supabase/phase32_bulk_contact_update.txt`.
- Use `apply_patch` for file edits and run lint, tests, and production build before deployment.

---

### Task 1: Add scoped category/checklist database support

**Files:**
- Create: `supabase/phase37_school_specific_categories.sql`
- Modify: `lib/app-state.ts:68-72`
- Modify: `lib/fetch-app-state.ts:516-518,571-572`
- Test: `tests/school-specific-category.test.mts`

**Interfaces:**
- Produces `TaskCategory { id, name, schoolId?: string }`.
- Produces `ChecklistTemplateItem { id, description, schoolId?: string, taskCategoryId?: string }`.
- The migration exposes `create_school_task_category(p_school_id text, p_name text)`, `rename_school_task_category(p_id text, p_name text)`, and `delete_school_task_category(p_id text)`.

- [ ] **Step 1: Write failing tests for scoped row mapping and migration guarantees**

Create `tests/school-specific-category.test.mts` with static checks that assert the migration has nullable `school_id` columns, partial unique indexes for global and per-school names, a category-to-checklist link, and all three RPC names. Add a pure `visibleSchoolItems` helper in `lib/app-state.ts` to the test target and assert that it returns global plus matching-school rows but excludes another school.

```ts
assert.deepEqual(
  visibleSchoolItems(
    [{ id: "global", schoolId: undefined }, { id: "a", schoolId: "school-a" }, { id: "b", schoolId: "school-b" }],
    "school-a",
  ).map((item) => item.id),
  ["global", "a"],
);
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --no-warnings --test tests/school-specific-category.test.mts`

Expected: FAIL because the helper and `phase37_school_specific_categories.sql` do not exist.

- [ ] **Step 3: Implement the migration and scoped row mapping**

Create an idempotent migration that:

```sql
alter table task_categories add column if not exists school_id text references schools(id) on delete cascade;
alter table checklist_template add column if not exists school_id text references schools(id) on delete cascade;
alter table checklist_template add column if not exists task_category_id text references task_categories(id) on delete cascade;
create unique index if not exists task_categories_global_lower_name_unique_idx
  on task_categories (lower(name)) where school_id is null;
create unique index if not exists task_categories_school_lower_name_unique_idx
  on task_categories (school_id, lower(name)) where school_id is not null;
```

Drop the old global unique index before adding the partial replacement indexes. Add `school_id`/`task_category_id` columns to the fetch selects and map database snake case to the optional camelCase fields. Add the generic pure helper:

```ts
export function visibleSchoolItems<T extends { schoolId?: string }>(items: T[], schoolId: string): T[] {
  return items.filter((item) => !item.schoolId || item.schoolId === schoolId);
}
```

Write RPCs that lock the category row where appropriate, create/update/delete its matching checklist row in the same transaction, and reject calls against global categories.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --no-warnings --test tests/school-specific-category.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit the scoped data foundation**

```bash
git add supabase/phase37_school_specific_categories.sql lib/app-state.ts lib/fetch-app-state.ts tests/school-specific-category.test.mts
git commit -m "feat: add school-specific category data"
```

### Task 2: Connect scoped actions and school-page filtering

**Files:**
- Modify: `app/(app)/schools/[id]/actions.ts:454-568`
- Modify: `app/(app)/schools/[id]/page.tsx:65-190`
- Modify: `lib/demo-app-state.ts`
- Modify: `tests/school-specific-category.test.mts`

**Interfaces:**
- Consumes `visibleSchoolItems`, the Task 1 types, and the three phase37 RPCs.
- Produces `addSchoolTaskCategory(formData)`, and supports `scope=school` in existing rename/delete/reorder actions.
- `TasksCard` and `ChecklistCard` receive only global plus current-school rows.

- [ ] **Step 1: Extend the failing tests for action/page contracts**

Add source assertions that the school page uses `visibleSchoolItems` for both `taskCategories` and `checklistTemplate`, and that actions submit a `schoolId`/`scope` value to a school-only create path. Add a pure demo-state test showing a school-only category and linked checklist item are inserted together and are absent from another school’s visible lists.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --no-warnings --test tests/school-specific-category.test.mts`

Expected: FAIL because the page and actions do not yet support school scope.

- [ ] **Step 3: Implement scoped actions and rendering inputs**

Keep `addTaskCategory` as the shared/global action. Add `addSchoolTaskCategory`, reading `schoolId` and `name`, which calls `create_school_task_category` in production and inserts both linked rows in demo mode. In rename/delete/reorder actions, read the category row’s scope first; use the phase37 RPCs for school rows and preserve the current shared paths for global rows.

In the school page, derive:

```ts
const categories = visibleSchoolItems(state.taskCategories || [], schoolId);
const checklistTemplate = visibleSchoolItems(state.checklistTemplate || [], schoolId);
```

Use `checklistTemplate` for checklist progress extraction and `ChecklistCard`, and `categories` for `TasksCard`. Keep school-specific ordering separate from global ordering by filtering the exact scoped IDs before validating reorder inputs.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --no-warnings --test tests/school-specific-category.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit scoped behavior**

```bash
git add app/(app)/schools/[id]/actions.ts app/(app)/schools/[id]/page.tsx lib/demo-app-state.ts tests/school-specific-category.test.mts
git commit -m "feat: link school categories to checklists"
```

### Task 3: Add the school-only category editor UI

**Files:**
- Modify: `components/tasks-card.tsx:240-440`
- Modify: `app/(app)/schools/[id]/page.tsx:160-190`
- Test: `tests/school-specific-category.test.mts`

**Interfaces:**
- Consumes `addSchoolTaskCategory(formData)` and category `schoolId` metadata.
- Produces an **Add for this school** form and a “This school only” label for scoped categories.

- [ ] **Step 1: Write the failing UI-source test**

Add assertions that `TasksCard` renders `Add for this school`, sends a hidden `schoolId`, and renders `This school only` only for a category with `schoolId`.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --no-warnings --test tests/school-specific-category.test.mts`

Expected: FAIL because the editor contains only the shared Add form.

- [ ] **Step 3: Implement the minimal editor changes**

Add an `addSchoolTaskCategory` prop to `TasksCard` and wire it from the page. Keep the shared **Add** form unmodified. Below it, render a compact `Add for this school` form with the same category-name input and hidden school ID. Render a muted inline “This school only” label next to scoped categories in both the editor and task section heading; do not add it for global categories.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --no-warnings --test tests/school-specific-category.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit the editor UI**

```bash
git add components/tasks-card.tsx app/(app)/schools/[id]/page.tsx tests/school-specific-category.test.mts
git commit -m "feat: add school-only category editor"
```

### Task 4: Refine destructive controls and status contrast

**Files:**
- Modify: `components/confirm-delete-button.tsx`
- Modify: `app/globals.css:132-149,195-204`
- Test: `tests/task-row-control-styles.test.mts`

**Interfaces:**
- Produces a compact, accessible red `×` destructive control without a filled background.
- Preserves existing status tone names and uses readable foreground tokens in both themes.

- [ ] **Step 1: Write failing style tests**

Extend `tests/task-row-control-styles.test.mts` to assert that `ConfirmDeleteButton` forces a ghost-style control with `text-destructive` and does not force `variant="destructive"`. Add CSS assertions that each light-mode status foreground token is a dark readable color rather than the same bright accent used in its background.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --no-warnings --test tests/task-row-control-styles.test.mts`

Expected: FAIL because the button forces the filled destructive variant and light status text uses low-contrast accent colors.

- [ ] **Step 3: Implement the visual refinements**

Update `ConfirmDeleteButton` to render the passed compact size with a ghost variant and a class equivalent to `text-destructive hover:bg-transparent hover:text-destructive/80`. Preserve the confirmation dialog and all caller labels. Replace light-mode status foreground token values with dark, semantically aligned text colors (for example dark teal success, dark amber warning, dark coral danger, dark orange paused); retain the current pale status backgrounds and dark-mode tokens.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --no-warnings --test tests/task-row-control-styles.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit the visual refinement**

```bash
git add components/confirm-delete-button.tsx app/globals.css tests/task-row-control-styles.test.mts
git commit -m "fix: improve task control contrast"
```

### Task 5: Verify migration, app, and deployment readiness

**Files:**
- Verify: `supabase/phase37_school_specific_categories.sql`
- Verify: `tests/*.test.mts`

- [ ] **Step 1: Inspect the migration for safe repeated execution**

Confirm it uses `if not exists`/`drop index if exists` where needed, does not delete existing categories/checklist entries, and grants RPC execution only to authenticated callers with team-member checks.

- [ ] **Step 2: Run the full lint and test suite**

Run:

```bash
npm.cmd run lint
node --no-warnings --test tests\password-reset.test.mts tests\task-ordering.test.mts tests\task-row-control-styles.test.mts tests\team-presence.test.mts tests\lint-config.test.mts tests\tooltip-anchor.test.mts tests\school-specific-category.test.mts
```

Expected: lint exits 0 and every test passes.

- [ ] **Step 3: Run the production build**

Run:

```bash
& 'C:\Users\Michelle Pink Rejuso\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\next\dist\bin\next build
```

Expected: build exits 0.

- [ ] **Step 4: Commit final verification changes**

```bash
git add tests
git commit -m "test: cover school-specific categories"
```

- [ ] **Step 5: Request code review before merging**

Dispatch a reviewer with the final base and head SHAs. Resolve every Critical or Important finding, then repeat lint, the complete test command, and the production build.

## Plan self-review

- Spec coverage: Tasks 1–3 implement scoped storage, linked checklist rows, filtering, actions, demo mode, and UI. Task 4 implements both requested visual changes. Task 5 verifies the migration and app.
- Placeholder scan: no deferred or unspecified implementation steps remain.
- Type consistency: `schoolId` and `taskCategoryId` are defined in Task 1 and consumed consistently in Tasks 2–3.
