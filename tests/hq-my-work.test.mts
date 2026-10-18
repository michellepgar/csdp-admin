// tests/hq-my-work.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { hqKeyOk, shapeMyWork, type MyWorkRows } from "../lib/hq-my-work.ts";

const base: MyWorkRows = {
  me: "Michelle", trackerUrl: "https://tracker.example", now: "2026-10-19T01:00:00.000Z",
  categories: [], files: [], categoryNames: [], schools: [], generalTasks: [], schoolData: {}, emails: [], issues: [],
  issueIdsWithComments: [], issueIdsMentioningMe: [], plan: [],
};

test("the key check needs the exact bearer secret", () => {
  assert.equal(hqKeyOk(null, "s3cret"), false);
  assert.equal(hqKeyOk("Bearer wrong!", "s3cret"), false);
  assert.equal(hqKeyOk("Bearer s3cret", ""), false);
  assert.equal(hqKeyOk("Bearer s3cret", "s3cret"), true);
});

test("tasks: hers and not Completed, with school, category, file name and link", () => {
  const out = shapeMyWork({
    ...base,
    categories: [
      { id: "c1", task_file_id: "f1", category_id: "k1", status: "Review", va_assigned: ["Michelle"], status_changed_at: "2026-10-15T00:00:00Z" },
      { id: "c2", task_file_id: "f1", category_id: "k1", status: "Completed", va_assigned: ["Michelle"], status_changed_at: null },
      { id: "c3", task_file_id: "f1", category_id: "k1", status: "", va_assigned: ["Ana"], status_changed_at: null },
    ],
    files: [{ id: "f1", school_id: "s1", file_name: "September logs" }],
    categoryNames: [{ id: "k1", name: "Attendance" }],
    schools: [{ id: "s1", name: "Riverside" }],
  });
  assert.deepEqual(out.tasks, [{ id: "c1", school: "Riverside", category: "Attendance", fileName: "September logs", status: "Review", statusChangedAt: "2026-10-15T00:00:00Z", link: "/schools/s1" }]);
});

test("general tasks, emails for her schools only, and plan rows", () => {
  const out = shapeMyWork({
    ...base,
    schools: [{ id: "s1", name: "Riverside" }, { id: "s2", name: "Hillcrest" }],
    generalTasks: [{ id: "g1", category: "Admin", description: "Update the checklist", status: "In Progress", va_assigned: ["Michelle"], status_changed_at: "2026-10-16T00:00:00Z" },
      { id: "g2", category: "Admin", description: "Done thing", status: "Completed", va_assigned: ["Michelle"], status_changed_at: null }],
    schoolData: { s1: { vaAssigned: "Michelle" }, s2: { vaAssigned: "Ana" } },
    emails: [{ id: "e1", school_id: "s1", description: "Ask for signed forms", status: "Needs My Response", created_at: "2026-10-14T00:00:00Z" },
      { id: "e2", school_id: "s2", description: "Not hers", status: "Needs My Response", created_at: "2026-10-14T00:00:00Z" },
      { id: "e3", school_id: "s1", description: "Waiting", status: "Waiting on Them", created_at: "2026-10-14T00:00:00Z" }],
    plan: [{ id: "p1", kind: "priority", label: "Finish Riverside first", task_file_category_id: null, general_task_id: null, sort_order: 0, created_at: "2026-10-17T00:00:00Z", completed_at: null },
      { id: "p2", kind: "meeting", label: "Team call", task_file_category_id: null, general_task_id: null, sort_order: null, created_at: "2026-10-17T00:00:00Z", completed_at: "2026-10-18T00:00:00Z" },
      { id: "p3", kind: "note", label: "private", task_file_category_id: null, general_task_id: null, sort_order: null, created_at: "2026-10-17T00:00:00Z", completed_at: null }],
  });
  assert.deepEqual(out.generalTasks, [{ id: "g1", category: "Admin", description: "Update the checklist", status: "In Progress", statusChangedAt: "2026-10-16T00:00:00Z", link: "/general-tasks" }]);
  assert.deepEqual(out.emails, [{ id: "e1", school: "Riverside", description: "Ask for signed forms", createdAt: "2026-10-14T00:00:00Z", link: "/schools/s1" }]);
  assert.deepEqual(out.plan, [{ id: "p1", kind: "priority", label: "Finish Riverside first", taskId: null, generalTaskId: null, sortOrder: 0, createdAt: "2026-10-17T00:00:00Z" }]);
});

test("issues: only Pending ones that involve her, with only safe fields", () => {
  const issue = (id: string, extra: Record<string, unknown>) => ({ id, type: "correction", category: "Attendance", subcategory: null, school: "Riverside", status: "Pending", created_at: "2026-10-10T00:00:00Z", reported_by: "Ana", comment_ack_by: [] as string[],
    student_name: "SECRET NAME", dob: "2015-01-01", insurance_number: "123", student_record_link: "x", correct_info: "y", description: "free text", remarks: "free", ...extra });
  const out = shapeMyWork({
    ...base,
    issues: [issue("i1", { reported_by: "Michelle" }), issue("i2", {}), issue("i3", {}), issue("i4", { status: "Resolved", reported_by: "Michelle" }), issue("i5", { comment_ack_by: ["Michelle"] })],
    issueIdsWithComments: ["i2", "i5"], issueIdsMentioningMe: ["i3"],
  });
  assert.deepEqual(out.issues.map((i) => [i.id, i.why]), [["i1", ["reported"]], ["i2", ["unseen-comments"]], ["i3", ["mentioned"]]]);
  const json = JSON.stringify(out);
  for (const bad of ["SECRET NAME", "2015-01-01", "insurance", "student", "free text", "remarks", "correct_info"]) assert.equal(json.includes(bad), false, bad);
  assert.deepEqual(Object.keys(out.issues[0]).sort(), ["category", "createdAt", "id", "link", "school", "status", "subcategory", "type", "why"]);
});

test("the response has exactly the allowed top-level keys", () => {
  assert.deepEqual(Object.keys(shapeMyWork(base)).sort(), ["emails", "fetchedAt", "generalTasks", "issues", "me", "plan", "tasks", "trackerUrl"]);
});
