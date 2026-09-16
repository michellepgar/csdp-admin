import assert from "node:assert/strict";
import test from "node:test";
import { legacyTasksToTaskFiles, normalizeSelectedCategoryIds, visibleTaskCategories } from "../lib/shared-task-files.ts";

test("category selection removes empty values and duplicates while preserving order", () => {
  assert.deepEqual(normalizeSelectedCategoryIds(["teacher", "", "teacher", "treatment"]), ["teacher", "treatment"]);
});

test("task table only shows categories used by at least one file", () => {
  const categories = [
    { id: "teacher", name: "Adding Teacher & Homeroom" },
    { id: "treatment", name: "Treatment Recommendation" },
    { id: "insurance", name: "Insurance" },
  ];
  const files = [{
    id: "file", fileName: "Garcia.pdf", sortOrder: 0, createdAt: "2026-09-16",
    categories: [{ id: "a", taskFileId: "file", categoryId: "teacher", category: categories[0].name, status: "", vaAssigned: [], sortOrder: 0 }],
  }];

  assert.deepEqual(visibleTaskCategories(categories, files).map((item) => item.id), ["teacher"]);
});

test("legacy rows with the same filename become one shared file", () => {
  const files = legacyTasksToTaskFiles([
    { id: "one", category: "Initial", fileName: "Garcia.pdf", status: "", vaAssigned: [], createdAt: "2026-09-16", sortOrder: 0 },
    { id: "two", category: "Photos", fileName: "Garcia.pdf", status: "", vaAssigned: [], createdAt: "2026-09-16", sortOrder: 1 },
  ], [{ id: "initial", name: "Initial" }, { id: "photos", name: "Photos" }]);
  assert.equal(files.length, 1);
  assert.equal(files[0].categories.length, 2);
});
