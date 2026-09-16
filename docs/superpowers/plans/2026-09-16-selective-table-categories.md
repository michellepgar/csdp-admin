# Selective Table Categories Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; user requested implementation and deployment in this session. Track steps with checkboxes.

**Goal:** Attach optional categories to selected existing file rows with aligned tables.

**Architecture:** Stable task_files.table_id preserves table membership independently of category sets. An authenticated atomic RPC inserts selected assignments; table rendering derives category union ordered by assignment position.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, Supabase PostgreSQL, node:test/PGlite.

**Spec:** docs/superpowers/specs/2026-09-16-selective-table-categories-design.md

## Global Constraints

- Duplicate names remain unrestricted; use IDs, not names.
- Preserve existing counts, statuses, signatures, files and legacy communications.
- Category dropdown first, filename second; checklist stays right and collapsible.
- New assignments apply only to explicitly selected rows; untouched rows stay in the table.
- Fixed 72px Count column, 240px task columns, 28px Remove column; filename flexible.

### Task 1: Stable table grouping and aligned columns

Files: lib/shared-task-files.ts, lib/app-state.ts, lib/fetch-app-state.ts, tests/task-table-groups.test.mts, tests/task-count-columns.test.mts.

Interface: TaskFile.tableId?: string; taskTableColumns returns count/file/task/remove columns; groupTaskTables returns stable membership with union categories.

- [ ] Add failing tests: `assert.equal(groupTaskTables(catalog,[selected,unselected]).length,1)` for matching tableId despite different category sets; assert filename index 1 for no-count and multi-count tables.
- [ ] Run `node --test tests/task-table-groups.test.mts tests/task-count-columns.test.mts` and observe expected failures.
- [ ] Implement stable membership `file.tableId || JSON.stringify(sortedCategoryIds)` and assignment-position category ordering; add reserved Count and Remove columns.
- [ ] Run targeted tests and full TypeScript checks.

### Task 2: Selected assignment RPC and communications migration

Files: supabase/phase41_selective_table_categories.sql, tests/shared-file-database.test.mts, school actions, demo session.

Interface: add_task_file_category(p_school_id text,p_table_id text,p_file_ids text[],p_category_id text) returns void; server addCategoryToFiles(FormData) returns TaskFileActionResult.

- [ ] Test selected/unselected rows, existing status preservation, repeated submit, invalid school/file/category/table and unauthorized requests against real PGlite.
- [ ] Test migration repeatability and meaningful communications copying with unchanged source fields.
- [ ] Run tests RED before implementing SQL.
- [ ] Add nullable table_id and backfill old exact category-set keys; initialize new file membership after its first assignment. Validate all references before inserting with `on conflict(task_file_id,category_id) do nothing` under school advisory lock.
- [ ] Create global communications categories/checklist entries and copy meaningful communications once with deterministic assignment IDs, retaining sources. Extend backup restore to restore tableId.
- [ ] Add authenticated action; mirror selection and grouping in demo, preserving legacy task identity.
- [ ] Run database tests GREEN.

### Task 3: Table category picker and deployment

Files: components/task-table-category-picker.tsx, components/tasks-card.tsx, school page props, legacy style-contract tests.

- [ ] Add selection helper tests: choosing only file B yields only B, already assigned rows are excluded, stale IDs rejected.
- [ ] Implement collapsed Add category form per table using unchecked file IDs and error-safe submission; single initial dropdown in file-entry form.
- [ ] Render reserved Count cells, flexible filename, fixed right task columns, and final file-remove cell; remove inline communications section.
- [ ] Run `npm test`, `npm run lint`, `npm exec tsc -- --noEmit`, and production build; read-only reviewer gate.
- [ ] Apply additive SQL to the production Supabase project, verify preservation and successful result; commit/fast-forward main/push and verify Vercel Ready.
