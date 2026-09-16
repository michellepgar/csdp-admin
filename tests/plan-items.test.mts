import assert from "node:assert/strict";
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
