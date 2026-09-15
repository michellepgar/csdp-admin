import assert from "node:assert/strict";
import test from "node:test";
import { getOrderedItems, hasExactIds, nextSortOrder, normalizedCategoryName } from "../lib/task-ordering.ts";

test("orders task rows by the submitted IDs", () => {
  const tasks = [
    { id: "one", sortOrder: 0 },
    { id: "two", sortOrder: 1 },
    { id: "three", sortOrder: 2 },
  ];

  assert.deepEqual(getOrderedItems(tasks, ["three", "one", "two"]).map((task) => task.id), ["three", "one", "two"]);
});

test("rejects a task order containing an ID outside the current category", () => {
  assert.equal(hasExactIds(["one", "two"], ["two", "other"]), false);
});

test("assigns the next position after the largest current sort order", () => {
  assert.equal(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 4 }]), 5);
  assert.equal(nextSortOrder([]), 0);
});

test("normalizes category names before duplicate checks", () => {
  assert.equal(normalizedCategoryName("  Follow Up  "), "follow up");
});
