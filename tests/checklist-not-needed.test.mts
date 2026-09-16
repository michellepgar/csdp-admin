import assert from "node:assert/strict";
import test from "node:test";
import { checklistSummary, nextChecklistNotNeededEntry } from "../lib/app-state.ts";

test("not-needed checklist rows are excluded from the progress total", () => {
  const template = [{ id: "done", description: "Done" }, { id: "unused", description: "Unused" }];
  const progress = { done: { status: "Done" }, unused: { status: "Open", notNeeded: true } };
  assert.deepEqual(checklistSummary(template, progress), { done: 1, total: 1 });
});

test("marking an item not needed clears completion and can be undone", () => {
  assert.deepEqual(nextChecklistNotNeededEntry({ status: "Done", checkedBy: "Michelle" }, true), { status: "Open", notNeeded: true });
  assert.deepEqual(nextChecklistNotNeededEntry({ status: "Open", notNeeded: true }, false), { status: "Open", notNeeded: false });
});
