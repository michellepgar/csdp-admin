import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the issue types migration adds a team-only table and a restrictive link from issues", () => {
  const sql = readFileSync("supabase/phase66_issue_types.sql", "utf8");
  assert.match(sql, /create table if not exists issue_types/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /is_team_member\(\)/);
  assert.match(sql, /add column if not exists custom_type_id text references issue_types\(id\) on delete restrict/);
});

test("a missing issue_types table never breaks loading the app", () => {
  const source = readFileSync("lib/fetch-app-state.ts", "utf8");
  // The custom-type link is read in its own query, not added to the main issues select.
  assert.doesNotMatch(source, /select\("id, type, reported_by[^"]*custom_type_id/);
  assert.match(source, /supabase\.from\("issues"\)\.select\("id, custom_type_id"\)/);
  assert.match(source, /issueTypesResult\.error \? \[\]/);
});

test("adding and removing issue types refuses duplicates and types still in use", () => {
  const source = readFileSync("app/(app)/issues/actions.ts", "utf8");
  assert.match(source, /export async function addIssueType/);
  assert.match(source, /is already a type/);
  assert.match(source, /export async function removeIssueType/);
  assert.match(source, /Issues are still filed under this type/);
  assert.match(source, /type === "custom"/);
});

test("the Issues page, Overview and Quick add all know about custom types", () => {
  assert.match(readFileSync("app/(app)/issues/page.tsx", "utf8"), /issueTypes\.map\(\(customType\)/);
  assert.match(readFileSync("app/(app)/overview/page.tsx", "utf8"), /state\.issueTypes/);
  assert.match(readFileSync("components/quick-add-issue-panel.tsx", "utf8"), /issueTypes\.map/);
  assert.match(readFileSync("app/(app)/layout.tsx", "utf8"), /issueTypes: state\.issueTypes/);
});

test("the Issues form's description/link inputs have a min-width, so a narrow window wraps them onto their own line instead of squeezing them unreadably", () => {
  const source = readFileSync("components/issues-list.tsx", "utf8");
  const flexOneInputs = [...source.matchAll(/<Input[^>]*flex-1[^>]*\/>/g)].map((m) => m[0]);
  // 3, not 4 -- correction and charting now share one Student Record
  // Link input instead of each type having its own (see SchoolRecordTable
  // and its shared AddIssueForm fields, Review Patient Information and
  // Charting Questions have the exact same field shape now).
  assert.ok(flexOneInputs.length >= 3, "expected the description/link inputs in AddIssueForm");
  for (const input of flexOneInputs) assert.match(input, /min-w-40/, input);
});
