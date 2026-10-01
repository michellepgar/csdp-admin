import test from "node:test";
import assert from "node:assert/strict";
import { comparePriorities, continuingPlanItemIds, movePriorityId } from "../lib/plan-order.ts";
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

test("continuingPlanItemIds picks planned tasks that are Paused or In Progress", () => {
  const plan: PlanItem[] = [
    { id: "p1", kind: "task", schoolId: "s1", taskFileCategoryId: "c1", label: "a", createdBy: "x", createdAt: "1" },
    { id: "p2", kind: "task", schoolId: "s1", taskFileCategoryId: "c2", label: "b", createdBy: "x", createdAt: "2" },
    { id: "p3", kind: "task", generalTaskId: "g1", label: "c", createdBy: "x", createdAt: "3" },
    { id: "p4", kind: "task", generalTaskId: "g2", label: "d", createdBy: "x", createdAt: "4" },
    { id: "p5", kind: "priority", label: "e", createdBy: "x", createdAt: "5" },
    { id: "p6", kind: "task", schoolId: "gone", taskFileCategoryId: "c9", label: "f", createdBy: "x", createdAt: "6" },
  ];
  const schoolData = {
    s1: { taskFiles: [{ id: "f1", fileName: "f", categories: [{ id: "c1", status: "Paused" }, { id: "c2", status: "Not Started" }] }] },
  } as unknown as Parameters<typeof continuingPlanItemIds>[1];
  const general = [{ id: "g1", status: "In Progress" }, { id: "g2", status: "Completed" }] as unknown as Parameters<typeof continuingPlanItemIds>[2];
  assert.deepEqual(continuingPlanItemIds(plan, schoolData, general), ["p1", "p3"]);
});
