import test from "node:test";
import assert from "node:assert/strict";
import { shiftAvailability } from "../lib/shift.ts";

const noon = new Date("2026-09-21T16:00:00Z"); // noon Eastern

test("no record: can start, can't end", () => {
  const a = shiftAvailability([], "Jane", noon);
  assert.equal(a.canStart, true);
  assert.equal(a.canEnd, false);
  assert.ok(a.endHint);
});

test("in a shift today: can end, can't start", () => {
  const a = shiftAvailability([{ vaName: "Jane", status: "working", changedAt: "2026-09-21T13:00:00Z" }], "Jane", noon);
  assert.equal(a.canStart, false);
  assert.equal(a.canEnd, true);
  assert.ok(a.startHint);
});

test("after ending: can start, can't end", () => {
  const a = shiftAvailability([{ vaName: "Jane", status: "ended", changedAt: "2026-09-21T15:00:00Z" }], "Jane", noon);
  assert.equal(a.canStart, true);
  assert.equal(a.canEnd, false);
});

test("a shift left open from an earlier day unlocks Start, and can still be ended", () => {
  const a = shiftAvailability([{ vaName: "Jane", status: "working", changedAt: "2026-09-20T15:00:00Z" }], "Jane", noon);
  assert.equal(a.canStart, true);
  assert.equal(a.canEnd, true);
});

test("someone else's shift doesn't affect you", () => {
  const a = shiftAvailability([{ vaName: "Alex", status: "working", changedAt: "2026-09-21T13:00:00Z" }], "Jane", noon);
  assert.equal(a.canStart, true);
  assert.equal(a.canEnd, false);
});
