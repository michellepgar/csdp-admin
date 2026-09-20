import test from "node:test";
import assert from "node:assert/strict";
import { comparePriorities, movePriorityId } from "../lib/plan-order.ts";
import type { PlanItem } from "../lib/app-state.ts";

const item = (id: string, createdAt: string, sortOrder?: number): PlanItem => ({ id, kind: "priority", label: id, createdBy: "x", createdAt, sortOrder });

test("ordered priorities come first, then unordered oldest first", () => {
  const list = [item("c", "2026-01-03"), item("b", "2026-01-02", 1), item("a", "2026-01-04", 0), item("d", "2026-01-01")];
  assert.deepEqual(list.sort(comparePriorities).map((i) => i.id), ["a", "b", "d", "c"]);
});

test("movePriorityId swaps neighbours and refuses at the ends", () => {
  const list = [item("a", "1", 0), item("b", "2", 1), item("c", "3", 2)];
  assert.deepEqual(movePriorityId(list, "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(movePriorityId(list, "b", "down"), ["a", "c", "b"]);
  assert.equal(movePriorityId(list, "a", "up"), null);
  assert.equal(movePriorityId(list, "c", "down"), null);
  assert.equal(movePriorityId(list, "zzz", "up"), null);
});
