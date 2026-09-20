import assert from "node:assert/strict";
import test from "node:test";
import { generalNoteKey, makeNoteLookup, parseNoteKey, planItemNoteKey, planNoteKey, taskNoteKey } from "../lib/work-notes.ts";
import type { PlanItem, WorkNote } from "../lib/app-state.ts";

const base: PlanItem = { id: "p1", kind: "priority", label: "x", createdBy: "Jane", createdAt: "x" };

test("keys are filed by what the note is about", () => {
  assert.equal(taskNoteKey("c1"), "t:c1");
  assert.equal(generalNoteKey("g1"), "g:g1");
  assert.equal(planNoteKey("p1"), "p:p1");
});

test("a task item on a plan shares its note with the task itself, so the note follows it", () => {
  assert.equal(planItemNoteKey({ ...base, kind: "task", taskFileCategoryId: "c1", schoolId: "1" }), "t:c1");
  assert.equal(planItemNoteKey({ ...base, kind: "task", generalTaskId: "g1" }), "g:g1");
});

test("a priority or reminder is filed under its own id", () => {
  assert.equal(planItemNoteKey({ ...base, kind: "priority" }), "p:p1");
  assert.equal(planItemNoteKey({ ...base, kind: "note" }), "p:p1");
});

test("keys parse back, and junk is rejected", () => {
  assert.deepEqual(parseNoteKey("t:abc-123"), { type: "task", id: "abc-123" });
  assert.deepEqual(parseNoteKey("g:g1"), { type: "general", id: "g1" });
  assert.deepEqual(parseNoteKey("p:x:y"), { type: "plan", id: "x:y" });
  assert.equal(parseNoteKey("x:1"), null);
  assert.equal(parseNoteKey("t:"), null);
  assert.equal(parseNoteKey("nonsense"), null);
});

test("the lookup is per person: two VAs on the same task keep separate notes", () => {
  const notes: WorkNote[] = [
    { itemKey: "t:c1", vaName: "Jane", note: "waiting on the school", updatedAt: "x" },
    { itemKey: "t:c1", vaName: "John", note: "scan was blurry", updatedAt: "x" },
  ];
  const noteFor = makeNoteLookup(notes);
  assert.equal(noteFor("t:c1", "Jane"), "waiting on the school");
  assert.equal(noteFor("t:c1", "John"), "scan was blurry");
  assert.equal(noteFor("t:c1", "Alex"), undefined);
  assert.equal(noteFor(undefined, "Jane"), undefined);
  assert.equal(makeNoteLookup(undefined)("t:c1", "Jane"), undefined);
});
