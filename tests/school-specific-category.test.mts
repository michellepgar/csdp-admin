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

test("school page filters shared and current-school category data", () => {
  const source = readFileSync("app/(app)/schools/[id]/page.tsx", "utf8");
  assert.match(source, /visibleSchoolItems\(state\.taskCategories \|\| \[\], schoolId\)/);
  assert.match(source, /visibleSchoolItems\(state\.checklistTemplate \|\| \[\], schoolId\)/);
});
