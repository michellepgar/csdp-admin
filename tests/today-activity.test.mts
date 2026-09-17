import assert from "node:assert/strict";
import test from "node:test";
import { todayActivityByVa } from "../lib/shared-task-files.ts";
import type { School, SchoolDataEntry, GeneralTask, PlanItem } from "../lib/app-state.ts";

const TODAY = new Date().toISOString();
const YESTERDAY = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

function school(id: string, name: string): School {
  return { id, name };
}

test("groups in-progress and completed-today tasks by VA, ignoring older completions", () => {
  const schools = [school("s1", "Angelo Elementary")];
  const schoolData: Record<string, SchoolDataEntry> = {
    s1: {
      vaAssigned: "",
      tasks: [
        { id: "t1", category: "Initial", fileName: "a.pdf", status: "In Progress", vaAssigned: ["Jane"], createdAt: TODAY, sortOrder: 0 },
        { id: "t2", category: "Follow up", fileName: "b.pdf", status: "Completed", vaAssigned: ["Jane"], createdAt: YESTERDAY, sortOrder: 1 },
        { id: "t3", category: "Review", fileName: "c.pdf", status: "Review", vaAssigned: ["John"], createdAt: TODAY, sortOrder: 2 },
      ],
    },
  };
  const statusChangedAt: Record<string, string> = { t2: YESTERDAY, t3: TODAY };
  const generalTasks: GeneralTask[] = [];

  const result = todayActivityByVa(schools, schoolData, generalTasks, statusChangedAt);

  assert.deepEqual(result.get("Jane"), [
    { schoolId: "s1", schoolName: "Angelo Elementary", category: "Initial", fileName: "a.pdf", status: "In Progress" },
  ]);
  assert.deepEqual(result.get("John"), [
    { schoolId: "s1", schoolName: "Angelo Elementary", category: "Review", fileName: "c.pdf", status: "Review" },
  ]);
});

test("general tasks completed today show up under 'General' with no schoolId", () => {
  const generalTasks: GeneralTask[] = [
    { id: "g1", category: "Admin", description: "File paperwork", status: "Completed", vaAssigned: ["Jane"], createdAt: TODAY },
  ];
  const result = todayActivityByVa([], {}, generalTasks, { g1: TODAY });
  assert.deepEqual(result.get("Jane"), [
    { schoolName: "General", category: "Admin", fileName: "File paperwork", status: "Completed" },
  ]);
});

test("a completed-today note reminder shows up as its own entry", () => {
  const planItems: PlanItem[] = [
    { id: "p1", kind: "note", vaName: "Jane", label: "Call the front desk back", createdBy: "Jane", createdAt: TODAY, completedAt: TODAY },
  ];
  const result = todayActivityByVa([], {}, [], {}, planItems);
  assert.deepEqual(result.get("Jane"), [
    { schoolName: "Reminder", category: "", fileName: "Call the front desk back", status: "" },
  ]);
});
