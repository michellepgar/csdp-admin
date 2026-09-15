# School Task Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global category ordering/renaming and per-school task ordering/file-name editing.

**Architecture:** Persist task order in `tasks.sort_order`; retain category order in `task_categories.sort_order`. Client drag handlers update focused server actions and optimistic local lists.

**Tech Stack:** Next.js 16, React, Supabase, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-15-school-task-ordering-design.md`

## Global Constraints

- Category changes apply to every school; task-file order applies only within one school/category.
- Category renames update existing task category values.
- Preserve the current order of existing rows during migration.

### Task 1: Persist and load task order

**Files:** Create `supabase/phase34_task_sort_order.sql`; modify `lib/app-state.ts`, `lib/fetch-app-state.ts`, school actions.

- [ ] Add/backfill `tasks.sort_order` by `(school_id, category, created_at, id)` and index it.
- [ ] Fetch and map `sort_order`; assign the next rank when adding a task.
- [ ] Write and run a failing test covering an ordered task-id update; implement `reorderTasks(schoolId, category, orderedIds)` for demo and Supabase state.

### Task 2: Manage categories

**Files:** Modify `components/tasks-card.tsx`, `app/(app)/schools/[id]/actions.ts`, school page.

- [ ] Add drag handles and optimistic category ordering to Edit categories.
- [ ] Add inline rename controls; update every task using the old name before revalidation.
- [ ] Test category order and rename payloads, including demo state.

### Task 3: Manage task files

**Files:** Modify `components/tasks-card.tsx`, school actions and page props.

- [ ] Add per-category drag handles that call `reorderTasks` with only the visible category's ids.
- [ ] Add an inline file-name editor with Save and Cancel, backed by `updateTaskFileName`.
- [ ] Test mismatched category ids are rejected and the file-name edit targets one task.

### Task 4: Verify and deploy

- [ ] Run the reset-flow suite plus new ordering tests, lint, and a production build.
- [ ] Apply `phase34_task_sort_order.sql` in Supabase SQL Editor before deployment.
- [ ] Review the diff, merge, push `main`, and verify category/task ordering in production.
