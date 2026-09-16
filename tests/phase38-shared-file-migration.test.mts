import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = () => readFileSync("supabase/phase38_shared_file_multi_category.sql", "utf8");

test("phase 38 creates one file with independent category assignments", () => {
  const sql = migration();
  assert.match(sql, /create table if not exists task_files/i);
  assert.match(sql, /create table if not exists task_file_categories/i);
  assert.match(sql, /unique\s*\(task_file_id, category_id\)/i);
  assert.match(sql, /create or replace function add_task_file/i);
});

test("phase 38 preserves legacy tasks and promotes scoped categories", () => {
  const sql = migration();
  assert.match(sql, /insert into task_files/i);
  assert.match(sql, /insert into task_file_categories/i);
  assert.match(sql, /update checklist_template/i);
  assert.match(sql, /update task_categories[\s\S]*school_id = null/i);
  assert.doesNotMatch(sql, /drop table\s+tasks/i);
});

test("phase 38 adds per-school checklist applicability", () => {
  const sql = migration();
  assert.match(sql, /add column if not exists not_needed boolean not null default false/i);
});

test("migration refuses ambiguous legacy assignments instead of discarding rows", () => {
  const sql = migration();
  assert.match(sql, /Ambiguous legacy tasks/);
  assert.match(sql, /having count\(\*\) > 1/i);
  assert.doesNotMatch(sql, /select distinct on \(f.id, c.id\)/i);
});

test("reorder requires each file exactly once", () => {
  assert.match(migration(), /count\(distinct id\) from unnest\(p_ordered_ids\)/i);
});

test("backfill preserves each assignment's original timestamp", () => {
  assert.match(migration(), /t\.sort_order, t\.created_at/);
  const fetch = readFileSync("lib/fetch-app-state.ts", "utf8");
  assert.match(fetch, /createdAt: assignment\.createdAt \|\| file\.createdAt/);
});
