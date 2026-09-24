import assert from "node:assert/strict";
import test from "node:test";
import { padTextClass } from "../lib/note-pad.ts";
import { clearTaskFromPlansDemo, statusLeavesPlan } from "../lib/plan-cleanup.ts";

test("light pads get dark text and dark pads get light text", () => {
  assert.equal(padTextClass(undefined), "");
  for (const light of ["#FFFFFF", "#FFD6E8", "#FFF3B0", "#CFE8FF", "#D4F5D4"]) assert.equal(padTextClass(light), "note-on-light-pad", light);
  for (const dark of ["#000000", "#1E3A8A", "#7F1D1D"]) assert.equal(padTextClass(dark), "note-on-dark-pad", dark);
});

test("only In Progress and Completed take a task off plans", () => {
  assert.equal(statusLeavesPlan("In Progress"), true);
  assert.equal(statusLeavesPlan("Completed"), true);
  assert.equal(statusLeavesPlan("Review"), false);
  assert.equal(statusLeavesPlan("Paused"), false);
  assert.equal(statusLeavesPlan(""), false);
});

test("clearing a task from plans leaves other plan items alone", () => {
  const state = {
    planItems: [
      { id: "1", kind: "task", vaName: "Jane", taskFileCategoryId: "t1" },
      { id: "2", kind: "task", vaName: "John", taskFileCategoryId: "t1" },
      { id: "3", kind: "task", vaName: "Jane", taskFileCategoryId: "t2" },
      { id: "4", kind: "task", vaName: "Jane", generalTaskId: "g1" },
      { id: "5", kind: "note", vaName: "Jane" },
    ],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a minimal state for the test
  clearTaskFromPlansDemo(state as any, { taskFileCategoryId: "t1" });
  assert.deepEqual(state.planItems.map((p) => p.id), ["3", "4", "5"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a minimal state for the test
  clearTaskFromPlansDemo(state as any, { generalTaskId: "g1" });
  assert.deepEqual(state.planItems.map((p) => p.id), ["3", "5"]);
});
