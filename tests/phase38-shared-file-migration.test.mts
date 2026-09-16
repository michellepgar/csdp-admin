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
