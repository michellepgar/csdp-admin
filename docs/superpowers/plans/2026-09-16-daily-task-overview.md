# Daily Task Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live daily Overview of active and newly completed school tasks without polluting it while legacy tasks are backfilled.

**Architecture:** Store a nullable Manila-local completion date on school tasks. Server actions set or clear it as status changes; Overview derives two lists from current task status and that date.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, React.

**Spec:** `docs/superpowers/specs/2026-09-16-daily-task-overview-design.md`

## Global Constraints

- Use `Asia/Manila` for the daily boundary.
- Only school task files participate in this version.
- Existing and previously completed tasks keep `completed_on = null`.
- Keep demo-state behavior aligned with Supabase behavior.

### Task 1: Persist daily completion dates

**Files:**
- Create: `supabase/phase36_task_completion_dates.sql`
- Modify: `lib/app-state.ts`, `lib/fetch-app-state.ts`, `lib/demo-app-state.ts`
- Test: `tests/daily-task-overview.test.mts`

- [ ] Write failing tests for Manila-date assignment and identifying a task completed today.
- [ ] Add nullable `completed_on date` with no backfill values; add it to the task query and `Task` mapping as `completedOn?: string`.
- [ ] Add pure helpers `manilaToday(now)` and `isCompletedToday(task, today)`; use them in demo task data.
- [ ] Run the test suite and commit `feat: store task completion dates`.

### Task 2: Add explicit legacy completion handling

**Files:**
- Modify: `app/(app)/schools/[id]/actions.ts`, `app/(app)/schools/[id]/page.tsx`, `components/tasks-card.tsx`
- Test: `tests/daily-task-overview.test.mts`

- [ ] Write failing tests that normal completion records today, reopening clears the date, and previously completed leaves it blank.
- [ ] Update `setTaskStatus` to set or clear `completed_on` and demo `completedOn` consistently.
- [ ] Add `markTaskPreviouslyCompleted(formData)` scoped to the school/task; set status Completed and clear completion date.
- [ ] Render a discreet Previously completed control only for editable non-completed task rows.
- [ ] Run the test suite and commit `feat: distinguish legacy task completion`.

### Task 3: Render the live Overview sections

**Files:**
- Modify: `app/(app)/overview/page.tsx`
- Test: `tests/daily-task-overview.test.mts`

- [ ] Write failing tests for grouping current In Progress tasks and Today-completed tasks by assigned VA, including Unassigned.
- [ ] Keep the existing Currently Working On section for `status === "In Progress"`.
- [ ] Add Completed Today, filtering with `isCompletedToday(task, manilaToday())`, linking every row to its school.
- [ ] Run tests and commit `feat: show completed tasks on daily overview`.

### Task 4: Verify and deploy

- [ ] Run `node --no-warnings --test tests/password-reset.test.mts tests/task-ordering.test.mts tests/daily-task-overview.test.mts`.
- [ ] Run `next build` and manually verify: current in-progress work remains tomorrow, normal completion appears Today, and Previously completed does not.
- [ ] Run `phase36_task_completion_dates.sql` in the configured Supabase project before deployment.
- [ ] Review, merge, push `main`, and verify the live Overview.
