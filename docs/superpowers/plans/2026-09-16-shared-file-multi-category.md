# Shared-file multi-category task table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each school file once, with independent category assignments and a per-school checklist “Not needed” state.

**Architecture:** Store file identity in `task_files`; store one category assignment in `task_file_categories`. Map the relations into one school-page table. Persist checklist applicability as `checklist_progress.not_needed`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-16-shared-file-multi-category-design.md`

## Global Constraints

- Category selection remains before file name.
- Categories are shared by every school; remove the school-only UI.
- Categories without files must not render in that school’s task table.
- Keep Yearly Checklist right-side and collapsible.
- Preserve all legacy task/checklist data during migration.
- Do not stage or modify `supabase/phase32_bulk_contact_update.txt`.

---

### Task 1: Add relational schema and safe migration

**Files:**
- Create: `supabase/phase38_shared_file_multi_category.sql`
- Create: `tests/phase38-shared-file-migration.test.mts`
- Modify: `tests/school-specific-category.test.mts`

**Interfaces:** Creates `task_files`, `task_file_categories`, authorized add/delete/reorder RPCs, and `checklist_progress.not_needed boolean not null default false`.

- [ ] **Step 1: Write the failing SQL contract test**

```ts
const sql = readFileSync("supabase/phase38_shared_file_multi_category.sql", "utf8");
assert.match(sql, /create table if not exists task_files/i);
assert.match(sql, /create table if not exists task_file_categories/i);
assert.match(sql, /unique \(task_file_id, category_id\)/i);
assert.match(sql, /not_needed boolean not null default false/i);
```

- [ ] **Step 2: Run it and expect failure**

Run: `node --import tsx --test tests/phase38-shared-file-migration.test.mts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the idempotent migration**

Create `task_files(id, school_id, file_name, sort_order, created_at)` and `task_file_categories(id, task_file_id, category_id, status, va_assigned, count, comms_status, comms_va_assigned, sort_order)`, with `unique(task_file_id, category_id)`. Add the same RLS/grants/team policies as Phase 2. Promote scoped categories into the shared list; when lowercased names collide, repoint `checklist_template.task_category_id` to the existing shared category before deleting the scoped duplicate. Group legacy `tasks` records by school plus normalized filename, create assignment rows preserving every visible value, and keep legacy `tasks` as a rollback source. Add RPCs for add file + category IDs, delete file, delete assignment, and reorder file IDs.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test tests/phase38-shared-file-migration.test.mts tests/school-specific-category.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add supabase/phase38_shared_file_multi_category.sql tests/phase38-shared-file-migration.test.mts tests/school-specific-category.test.mts`

Run: `git commit -m "feat: add shared file task migration"`

### Task 2: Map shared files and checklist applicability into app state

**Files:**
- Modify: `lib/app-state.ts:60-106,739-749`
- Modify: `lib/fetch-app-state.ts:466-600`
- Create: `tests/shared-file-app-state.test.mts`

**Interfaces:** Produces `TaskFile { id, fileName, sortOrder, categories }` and `TaskFileCategory { id, categoryId, category, status, vaAssigned, count, commsStatus, commsVaAssigned }`; completion ignores `notNeeded` rows.

- [ ] **Step 1: Write failing state tests**

```ts
assert.equal(checklistCompletion(stateWithDoneAndNotNeeded, "school"), 100);
assert.equal(taskFile.categories.length, 2);
```

- [ ] **Step 2: Run it and expect failure**

Run: `node --import tsx --test tests/shared-file-app-state.test.mts`

Expected: FAIL because the new types and calculation do not exist.

- [ ] **Step 3: Implement fetch mapping and types**

Fetch `task_files`, `task_file_categories`, and their category names in `fetchAppState`, group assignments under each file, and feed `SchoolDataEntry.taskFiles`. Map `not_needed` to `ChecklistProgressEntry.notNeeded`. Keep demo data compatible by grouping its legacy task array by file name. Change `checklistCompletion` to exclude not-needed template items from the denominator.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test tests/shared-file-app-state.test.mts tests/task-ordering.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add lib/app-state.ts lib/fetch-app-state.ts tests/shared-file-app-state.test.mts`

Run: `git commit -m "feat: map shared file task state"`

### Task 3: Build the shared task table and server actions

**Files:**
- Modify: `components/tasks-card.tsx`
- Modify: `app/(app)/schools/[id]/actions.ts:160-610`
- Modify: `app/(app)/schools/[id]/page.tsx:1-185`
- Create: `tests/shared-file-tasks-card.test.mts`

**Interfaces:** `TasksCard` receives `taskFiles`. File actions accept `taskFileId`; category assignment actions accept `assignmentId`. `addTask` accepts repeated `categoryIds` before `fileName`.

- [ ] **Step 1: Write failing UI/action tests**

```ts
assert.match(source, /name="categoryIds"[\s\S]*name="fileName"/);
assert.doesNotMatch(source, /No files yet in this category/);
assert.match(source, /taskFiles\.filter/);
```

- [ ] **Step 2: Run it and expect failure**

Run: `node --import tsx --test tests/shared-file-tasks-card.test.mts`

Expected: FAIL because TasksCard renders separate category sections.

- [ ] **Step 3: Implement the table and actions**

Select one category first and optionally add more category IDs before entering the file name. Filter visible columns to category IDs present in any file assignment. Render one file row with one drag handle, filename edit, and file delete; render each assignment’s VA/status/count/communications controls in its own category cell. Retarget all server actions to Phase 38 RPCs and assignment IDs. Remove `addSchoolTaskCategory`, its school-only labels, and all page props without changing the global category editor.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test tests/shared-file-tasks-card.test.mts tests/task-row-control-styles.test.mts tests/task-ordering.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add components/tasks-card.tsx 'app/(app)/schools/[id]/actions.ts' 'app/(app)/schools/[id]/page.tsx' tests/shared-file-tasks-card.test.mts`

Run: `git commit -m "feat: show multi-category files in one task table"`

### Task 4: Add the not-needed checklist state

**Files:**
- Modify: `components/checklist-card.tsx`
- Modify: `app/(app)/schools/[id]/actions.ts:30-90`
- Modify: `app/(app)/overview/page.tsx`
- Modify: `components/export-all-schools-button.tsx`
- Create: `tests/checklist-not-needed.test.mts`

**Interfaces:** Produces `setChecklistNotNeeded(formData)` with `schoolId`, `itemId`, and `notNeeded`; overview/export consume `checklistCompletion`.

- [ ] **Step 1: Write failing checklist tests**

```ts
assert.match(source, /aria-label="Mark .*not needed"/i);
assert.match(source, /Undo/);
assert.match(source, /line-through/);
```

- [ ] **Step 2: Run it and expect failure**

Run: `node --import tsx --test tests/checklist-not-needed.test.mts`

Expected: FAIL because no not-needed action exists.

- [ ] **Step 3: Implement control, state, and calculations**

Upsert `{ school_id, template_item_id, status: "Open", checked_by: null, not_needed }` on the existing checklist-progress key. Add a small red X, struck-through visible state, and Undo action; leave the panel’s position/collapse behavior untouched. Exclude not-needed rows from its count, Overview, and export percentages.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test tests/checklist-not-needed.test.mts tests/shared-file-app-state.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add components/checklist-card.tsx 'app/(app)/schools/[id]/actions.ts' 'app/(app)/overview/page.tsx' components/export-all-schools-button.tsx tests/checklist-not-needed.test.mts`

Run: `git commit -m "feat: exclude not-needed checklist items"`

### Task 5: Verify, migrate, and deploy

**Files:**
- Modify: `docs/superpowers/plans/2026-09-16-shared-file-multi-category.md` (check completed items only)

- [ ] **Step 1: Run all automated tests**

Run: `node --import tsx --test tests/*.test.mts`

Expected: PASS.

- [ ] **Step 2: Run lint and production build**

Run: `npm.cmd run lint`

Expected: PASS.

Run: `& 'C:\Users\Michelle Pink Rejuso\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\next\dist\bin\next build`

Expected: PASS.

- [ ] **Step 3: Apply and verify migration**

Run `supabase/phase38_shared_file_multi_category.sql` once in project `jqsqstjmfsqqrnoxpuvn`. Confirm a legacy task keeps its filename, category, VA/status, and checklist link. Confirm a new file can have two independent assignments and a checklist row can be marked not needed then undone.

- [ ] **Step 4: Push and deploy**

Run: `git add docs/superpowers/plans/2026-09-16-shared-file-multi-category.md`

Run: `git commit -m "docs: record shared file task rollout"`

Run: `git push origin main`

Run: `vercel --prod`
