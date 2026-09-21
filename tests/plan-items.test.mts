import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { diffPlanSelection } from "../lib/shared-task-files.ts";

test("diffPlanSelection returns ids to insert and rows to delete, by refId (works for either a task-file-category id or a general-task id)", () => {
  const existing = [
    { id: "p1", refId: "tfc-1" },
    { id: "p2", refId: "tfc-2" },
  ];
  const checkedIds = ["tfc-2", "tfc-3"];

  const { toInsert, toDeleteIds } = diffPlanSelection(existing, checkedIds);

  assert.deepEqual(toInsert, ["tfc-3"]);
  assert.deepEqual(toDeleteIds, ["p1"]);
});

test("savePlan drops a newly-checked id that no longer exists, instead of letting the insert fail the whole save", () => {
  const source = readFileSync("app/(app)/overview/actions.ts", "utf8");
  const savePlan = source.slice(source.indexOf("export async function savePlan"), source.indexOf("export async function addPriority"));
  // Only the about-to-be-inserted ids are re-checked against the real tables...
  assert.match(savePlan, /supabase\.from\("task_file_categories"\)\.select\("id"\)\.in\("id", taskDiff\.toInsert\)/);
  assert.match(savePlan, /supabase\.from\("general_tasks"\)\.select\("id"\)\.in\("id", generalDiff\.toInsert\)/);
  // ...and that filtered set is what actually gets inserted.
  assert.match(savePlan, /taskDiff\.toInsert = taskDiff\.toInsert\.filter\(\(id\) => validTaskIds\.has\(id\)\)/);
  assert.match(savePlan, /generalDiff\.toInsert = generalDiff\.toInsert\.filter\(\(id\) => validGeneralIds\.has\(id\)\)/);
  // The validation runs before the delete/insert, not after.
  assert.ok(savePlan.indexOf("validTaskIds") < savePlan.indexOf('supabase.from("plan_items").insert(rows)'));
});

test("savePlan tells the picker apart a real save from a click that changed nothing", () => {
  const source = readFileSync("app/(app)/overview/actions.ts", "utf8");
  const savePlan = source.slice(source.indexOf("export async function savePlan"), source.indexOf("export async function addPriority"));
  assert.match(savePlan, /return \{ error: demoError, changed \};/);
  assert.match(savePlan, /return \{ changed: toDeleteIds\.length \+ rows\.length \};/);
  const picker = readFileSync("components/plan-tomorrow-picker.tsx", "utf8");
  assert.match(picker, /No plans saved — nothing was added or changed\./);
  // Only a genuine no-op (result.changed falsy, no error) keeps the window open with that message.
  assert.match(picker, /else if \(!result\.changed\) \{/);
});
