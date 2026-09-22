import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = () => readFileSync("supabase/phase37_school_specific_categories.sql", "utf8");

test("migration scopes categories and linked checklist items to a school", () => {
  const sql = migration();
  assert.match(sql, /task_categories\s+add column if not exists school_id text references schools\(id\) on delete cascade/i);
  assert.match(sql, /checklist_template\s+add column if not exists school_id text references schools\(id\) on delete cascade/i);
  assert.match(sql, /task_category_id text references task_categories\(id\) on delete cascade/i);
  assert.match(sql, /task_categories_global_lower_name_unique_idx/);
  assert.match(sql, /task_categories_school_lower_name_unique_idx/);
});

test("migration provides atomic school-category operations", () => {
  const sql = migration();
  assert.match(sql, /create or replace function create_school_task_category\(p_school_id text, p_name text\)/);
  assert.match(sql, /create or replace function rename_school_task_category\(p_id text, p_name text\)/);
  assert.match(sql, /create or replace function delete_school_task_category\(p_id text\)/);
});

test("school page uses the shared category and checklist lists", () => {
  const source = readFileSync("app/(app)/schools/[id]/page.tsx", "utf8");
  // Still built from the one shared list (just with hasCount resolved
  // per school on top -- see phase68_task_category_count_per_school.sql),
  // not a reintroduced per-school category list of its own.
  assert.match(source, /const categories = \(state\.taskCategories \|\| \[\]\)\.map/);
  assert.match(source, /const checklistTemplate = state\.checklistTemplate \|\| \[\]/);
  assert.doesNotMatch(source, /addSchoolTaskCategory/);
});

test("category reorder validates only the categories visible on the school page", () => {
  const source = readFileSync("app/(app)/schools/[id]/actions.ts", "utf8");
  assert.match(source, /from\("task_categories"\)\.select\("id"\)\.in\("id", orderedIds\)/);
});
