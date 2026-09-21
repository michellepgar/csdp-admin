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
    { schoolId: "s1", schoolName: "Angelo Elementary", category: "Initial", fileName: "a.pdf", status: "In Progress", itemKey: "t:t1" },
  ]);
  assert.deepEqual(result.get("John"), [
    { schoolId: "s1", schoolName: "Angelo Elementary", category: "Review", fileName: "c.pdf", status: "Review", itemKey: "t:t3" },
  ]);
});

test("general tasks completed today show up under 'General' with no schoolId", () => {
  const generalTasks: GeneralTask[] = [
    { id: "g1", category: "Admin", description: "File paperwork", status: "Completed", vaAssigned: ["Jane"], createdAt: TODAY },
  ];
  const result = todayActivityByVa([], {}, generalTasks, { g1: TODAY });
  assert.deepEqual(result.get("Jane"), [
    { schoolName: "General", category: "Admin", fileName: "File paperwork", status: "Completed", itemKey: "g:g1" },
  ]);
});

test("a completed-today note reminder shows up as its own entry, marked Reviewed", () => {
  const planItems: PlanItem[] = [
    { id: "p1", kind: "note", vaName: "Jane", label: "Call the front desk back", createdBy: "Jane", createdAt: TODAY, completedAt: TODAY },
  ];
  const result = todayActivityByVa([], {}, [], {}, planItems);
  assert.deepEqual(result.get("Jane"), [
    { schoolName: "Reminder", category: "", fileName: "Call the front desk back", status: "Reviewed", itemKey: "p:p1" },
  ]);
});

test("Start my day clears work completed before it, even earlier the same day", () => {
  const start = new Date().toISOString();
  const before = new Date(Date.now() - 60e3).toISOString();
  const after = new Date(Date.now() + 60e3).toISOString();
  const generalTasks: GeneralTask[] = [
    { id: "g1", category: "Admin", description: "Done this morning", status: "Completed", vaAssigned: ["Jane"], createdAt: before },
    { id: "g2", category: "Admin", description: "Done after start", status: "Completed", vaAssigned: ["Jane"], createdAt: before },
    { id: "g3", category: "Admin", description: "Someone else's, no shift", status: "Completed", vaAssigned: ["John"], createdAt: before },
  ];
  const result = todayActivityByVa([], {}, generalTasks, { g1: before, g2: after, g3: before }, [], { Jane: start });
  assert.deepEqual(result.get("Jane")?.map((i) => i.fileName), ["Done after start"]);
  // John has no open shift, so the calendar date decides.
  assert.deepEqual(result.get("John")?.map((i) => i.fileName), ["Someone else's, no shift"]);
});

test("an email item marked Done shows as done for its school's VA, until the shift restarts", () => {
  const schools = [school("s1", "Angelo Elementary"), school("s2", "Baker Middle")];
  const email = (id: string, status: string, doneAt?: string) => ({ id, description: `Email ${id}`, status, addedBy: "Jane", createdAt: YESTERDAY, ...(doneAt ? { doneAt } : {}) });
  const schoolData: Record<string, SchoolDataEntry> = {
    s1: { vaAssigned: "Jane", emailTracker: [email("a", "Done", TODAY), email("b", "Done", YESTERDAY), email("c", "Done"), email("d", "Waiting on Them")] },
    s2: { vaAssigned: "", emailTracker: [email("e", "Done", TODAY)] },
  };
  const items = todayActivityByVa(schools, schoolData, [], {}).get("Jane") ?? [];
  // Done today -> shown as Done; done on an earlier day, or with no time recorded, or on a school
  // nobody has -> not shown; still-open items keep their own status.
  assert.deepEqual(items.map((i) => [i.fileName, i.status]), [["Email a", "Done"], ["Email d", "Waiting on Them"]]);
  // After "Start my day", what was finished before it is cleared.
  const cleared = todayActivityByVa(schools, schoolData, [], {}, [], { Jane: new Date(Date.now() + 60e3).toISOString() }).get("Jane") ?? [];
  assert.deepEqual(cleared.map((i) => i.fileName), ["Email d"]);
});
