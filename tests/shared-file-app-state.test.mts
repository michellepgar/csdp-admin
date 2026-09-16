import assert from "node:assert/strict";
import test from "node:test";
import { checklistCompletion, groupTaskFileRows } from "../lib/app-state.ts";

test("groups two independent assignments under one file", () => {
  const files = groupTaskFileRows(
    [{ id: "file-1", fileName: "Garcia.pdf", sortOrder: 0, createdAt: "2026-09-16" }],
    [
      { id: "a", taskFileId: "file-1", categoryId: "teacher", category: "Adding Teacher & Homeroom", status: "In Progress", vaAssigned: ["Michelle"], sortOrder: 0 },
      { id: "b", taskFileId: "file-1", categoryId: "treatment", category: "Treatment Recommendation", status: "Completed", vaAssigned: ["John"], sortOrder: 0 },
    ],
  );

  assert.equal(files.length, 1);
  assert.equal(files[0].fileName, "Garcia.pdf");
  assert.deepEqual(files[0].categories.map((item) => item.category), ["Adding Teacher & Homeroom", "Treatment Recommendation"]);
});

test("checklist completion excludes rows marked not needed", () => {
  const state = {
    checklistTemplate: [
      { id: "needed", description: "Needed" },
      { id: "unused", description: "Unused" },
    ],
    checklistProgress: {
      "school:needed": { status: "Done" },
      "school:unused": { status: "Open", notNeeded: true },
    },
  } as never;

  assert.equal(checklistCompletion(state, "school"), 100);
});
